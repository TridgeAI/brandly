import { generateStructured } from "../../llm";
import { ContentSystemSchema } from "../schemas";
import { MOMENT_LABELS } from "../audience";
import { toPromptContext } from "../projection";
import type { StageDefinition } from "./types";

/** Fills content pillars, category entry points, hashtags and rules where they are missing or weak. */
export const contentSystemStage: StageDefinition<Record<string, never>> = {
  id: "content-system",
  label: "Planning what to post about",
  reads: ["strategy", "identity", "voice"],
  writes: ["content"],
  async run(model, _input, { report }) {
    const hasEnough = model.content.pillars.length >= 3 && model.content.hashtagClusters.length >= 4;
    const moments = model.strategy.audience.moments.map((m) => MOMENT_LABELS[m]);
    if (hasEnough && model.content.categoryEntryPoints.length) {
      report({ id: "content", label: `${model.content.pillars.length} content pillars ready`, status: "done" });
      return { patches: [] };
    }
    report({ id: "content", label: "Planning content pillars", status: "info" });
    const r = await generateStructured(
      ContentSystemSchema,
      "You are a social media strategist. Plan a simple, specific content system for this brand.",
      `Return JSON:
{
  "pillars": ["4 content pillars, each 2-5 words"],
  "categoryEntryPoints": ["5 real-life moments when a customer would think of this brand${moments.length ? `, starting from: ${moments.join(", ")}` : ""}"],
  "hashtagClusters": ["8 hashtags with #, mix of broad and niche"],
  "do": ["3 content rules"],
  "dont": ["3 things to never post"]
}`,
      { task: "fast", maxTokens: 900, cachedContext: toPromptContext(model) }
    );
    report({ id: "content", label: `Planned ${r.pillars.length} content pillars`, detail: r.pillars.join(" · "), status: "done" });
    return {
      patches: [{ patch: { content: r }, options: { source: "generated", confidence: 0.6 } }],
    };
  },
};
