import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
import type { BrandDNA, Platform, TriggerConfig } from "@/lib/types";
import type { BrandModel } from "@/lib/brand/model";
import { fetchRssFeed, fetchProductPageContent } from "@/lib/automation-utils";
import { n8nEnabled } from "@/lib/n8n";
import { generatePost } from "@/lib/content/generate";
import { AuthError, errorResponse, requireSession } from "@/lib/db/session";

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const body: {
      brandDNA: BrandDNA;
      /** Richer brand context; preferred over brandDNA when present. */
      brandModel?: BrandModel;
      triggerType: TriggerConfig["type"];
      triggerConfig: TriggerConfig; // Pass the full trigger config now
      platforms: string[];
    } = await req.json();
    const { brandDNA, brandModel, triggerType, triggerConfig, platforms } = body;

    // With n8n, the workflow reads the RSS feed / product page itself.
    let context = "";
    if (!n8nEnabled()) {
      if (triggerType === "rss" && triggerConfig.type === "rss") {
        const rssItems = await fetchRssFeed(triggerConfig.feedUrl);
        if (rssItems && rssItems.length > 0) {
          // For simplicity, take the latest item. In a real app, you'd track fetched items.
          const latestItem = rssItems[0];
          context = `Latest RSS article from ${triggerConfig.feedUrl}:\nTitle: ${latestItem.title}\nSnippet: ${latestItem.contentSnippet || latestItem.summary || latestItem.description || ""}`;
        } else {
          context = `No new articles found in RSS feed: ${triggerConfig.feedUrl}`;
        }
      } else if (triggerType === "product_update" && triggerConfig.type === "product_update") {
        const pageContent = await fetchProductPageContent(triggerConfig.sourceUrl);
        if (pageContent) {
          context = `Product page content from ${triggerConfig.sourceUrl}:\n${pageContent.slice(0, 1000)}...`;
        } else {
          context = `Failed to fetch content from product page: ${triggerConfig.sourceUrl}`;
        }
      } else if (triggerType === "recurring" && triggerConfig.type === "recurring") {
        context = `Recurring post — topic: ${triggerConfig.topic || "general brand content"}`;
      }
    }

    const result = await generatePost({
      feature: "automation",
      model: brandModel,
      dna: brandDNA,
      platforms: (platforms?.length ? platforms : ["instagram"]) as Platform[],
      topic: triggerConfig?.type === "recurring" ? triggerConfig.topic : undefined,
      // n8n fills {{TRIGGER_CONTEXT}} with what it read from the feed / page.
      triggerContext: n8nEnabled() ? "{{TRIGGER_CONTEXT}}" : context || undefined,
      n8nBody: body as unknown as Record<string, unknown>,
    });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthError) return errorResponse(err, "automation");
    console.error("[automation]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}