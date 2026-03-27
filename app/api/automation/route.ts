import { NextRequest, NextResponse } from "next/server";
import { generateText, parseJSON } from "@/lib/llm";
import type { BrandDNA, GeneratedPost, TriggerConfig } from "@/lib/types";
import { fetchRssFeed, fetchProductPageContent } from "../../lib/automation-utils"; // New import

const SYSTEM = `You are an automated social media content generator.
Generate content based on the provided trigger context and brand DNA.
Return ONLY a JSON object — no markdown.`;

export async function POST(req: NextRequest) {
  try {
    const body: {
      brandDNA: BrandDNA;
      triggerType: TriggerConfig["type"];
      triggerConfig: TriggerConfig; // Pass the full trigger config now
      platforms: string[];
    } = await req.json();

    const { brandDNA, triggerType, triggerConfig, platforms } = body;

    let context = "";

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

    const userPrompt = `Brand DNA:
${JSON.stringify(brandDNA, null, 2)}

Automation trigger:
- Type: ${triggerType}
- Context: ${context || "No specific context provided."}
- Target platforms: ${platforms.join(", ")}

Auto-generate a post and return:
{
  "caption": string,
  "hashtags": string[],
  "imagePrompt": string,
  "cta": string,
  "bestTimeToPost": string,
  "postType": string,
  "platformVariants": {}
}`;

    const raw = await generateText(SYSTEM, userPrompt, 1500);
    const post = parseJSON<GeneratedPost>(raw);

    if (!post) {
      return NextResponse.json({ error: "Failed to generate post" }, { status: 500 });
    }

    return NextResponse.json({ post });
  } catch (err) {
    console.error("[automation]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}