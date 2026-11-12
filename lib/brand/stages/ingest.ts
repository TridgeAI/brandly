import { analyseImages, parseJSON } from "../../llm";
import { fetchWebsiteEvidence, type WebsiteEvidence } from "../../web";
import { VisualInsightsSchema, type VisualInsights } from "../schemas";
import type { Evidence } from "../model";
import type { StageDefinition } from "./types";

export interface IngestInput {
  websiteUrl?: string;
  igHandle?: string;
  /** Base64 JPEGs: rasterised PDF pages and/or Instagram screenshots. */
  images?: string[];
  imageSource?: "pdf" | "instagram" | "upload";
}

export interface IngestOutput {
  website?: WebsiteEvidence;
  visual?: VisualInsights;
  igHandle?: string;
}

const VISION_PROMPT = `These images come from one brand (catalogue pages, social posts or screenshots).
Describe what is actually visible. Return JSON:
{
  "colors": ["#RRGGBB", ...up to 6 brand colours you can see, most used first],
  "visualStyle": "one sentence on layout, photography and graphic style",
  "typographyFeel": "one sentence on the typefaces you see",
  "vibe": ["3-5 words"],
  "productsServices": ["what is being sold"],
  "motifs": "recurring shapes, patterns or props",
  "audienceHints": "who the images seem aimed at (age, lifestyle, spending level), only if visible",
  "tone": "tone of any text you can read"
}`;

/** Collects raw evidence. No brand decisions are made here. */
export const ingestStage: StageDefinition<IngestInput> = {
  id: "ingest",
  label: "Reading your sources",
  reads: [],
  writes: [],
  async run(model, input, { report }) {
    const evidence: Evidence[] = [];
    const output: IngestOutput = { igHandle: input.igHandle?.replace(/^@/, "") || undefined };
    const now = new Date().toISOString();

    const jobs: Promise<void>[] = [];

    if (input.websiteUrl?.trim()) {
      jobs.push(
        (async () => {
          report({ id: "site", label: "Reading your website", status: "info" });
          try {
            const site = await fetchWebsiteEvidence(input.websiteUrl!);
            output.website = site;
            report({ id: "site", label: `Read ${new URL(site.url).hostname}`, detail: site.title || undefined, status: "done" });
            if (site.logoUrl) report({ id: "logo", label: "Found your logo", status: "done", image: site.logoUrl });
            else report({ id: "logo", label: "No logo found on the site", detail: "You can upload one later", status: "warn" });
            if (site.colors.length) report({ id: "colors", label: `Found ${site.colors.length} brand colours`, status: "done", swatches: site.colors });
            else report({ id: "colors", label: "No clear brand colours in the site's styles", status: "warn" });
            if (site.fonts.length) report({ id: "fonts", label: `Fonts: ${site.fonts.slice(0, 2).join(", ")}`, status: "done", fonts: site.fonts });
            report({ id: "copy", label: `Read ${site.headings.length} headlines and the page copy`, status: "done" });
            evidence.push({
              source: "website",
              url: site.url,
              summary: [site.title, site.description].filter(Boolean).join(" — "),
              colors: site.colors,
              fonts: site.fonts,
              logoUrl: site.logoUrl,
              copySample: site.copySample.slice(0, 1500),
              capturedAt: now,
            });
          } catch (err) {
            report({
              id: "site",
              label: "Couldn't read the website",
              detail: err instanceof Error ? err.message : String(err),
              status: "error",
            });
          }
        })()
      );
    }

    if (input.images?.length) {
      jobs.push(
        (async () => {
          const what = input.imageSource === "pdf" ? "catalogue pages" : "images";
          report({ id: "visual", label: `Looking at ${input.images!.length} ${what}`, status: "info" });
          try {
            const raw = await analyseImages(input.images!.slice(0, 8), `Brand name: ${model.name}\n\n${VISION_PROMPT}`, 1200);
            const visual = VisualInsightsSchema.parse(parseJSON(raw) ?? {});
            output.visual = visual;
            report({
              id: "visual",
              label: `Studied ${input.images!.length} ${what}`,
              detail: visual.visualStyle || undefined,
              status: "done",
              swatches: visual.colors.slice(0, 6),
            });
            evidence.push({
              source: input.imageSource === "instagram" ? "instagram" : input.imageSource === "pdf" ? "pdf" : "upload",
              summary: [visual.visualStyle, visual.motifs].filter(Boolean).join(" "),
              colors: visual.colors,
              capturedAt: now,
            });
          } catch (err) {
            report({ id: "visual", label: `Couldn't read the ${what}`, detail: err instanceof Error ? err.message : String(err), status: "error" });
          }
        })()
      );
    }

    if (output.igHandle && !input.images?.length) {
      report({
        id: "ig",
        label: `Noted @${output.igHandle}`,
        detail: "Instagram doesn't let apps read posts without a login. Add a few post screenshots for a better match.",
        status: "warn",
      });
    }

    await Promise.all(jobs);
    return { patches: [], evidence, output: output as Record<string, unknown> };
  },
};
