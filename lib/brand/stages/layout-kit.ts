import { generateStructured } from "../../llm";
import { LayoutKitSchema } from "../schemas";
import { LAYOUT_IDS, type LayoutId, type LayoutKit } from "../model";
import { toPromptContext } from "../projection";
import { defaultLayoutKit, LAYOUT_LABELS, SELECTABLE_LAYOUTS } from "../../render/kit";
import type { StageDefinition } from "./types";

const LAYOUT_NOTES: Record<string, string> = {
  "photo-band": "photo on top, solid colour band with headline below (versatile)",
  "full-bleed": "photo fills the frame, headline over a dark gradient (moody, lifestyle)",
  "big-number": "one huge number with a short line (data, offers)",
  quote: "large quote card, text only (opinions, testimonials)",
  split: "half photo, half colour (comparisons, before/after)",
  framed: "product photo in a frame with headline and button (products, premium)",
  checklist: "numbered list on brand colour (tips, steps)",
  "myth-fact": "myth crossed out, fact highlighted (education)",
  "carousel-cover": "cover slide for multi-slide carousels",
};

/** Chooses the brand's layout kit once (strong model). Skipped when a kit already exists. */
export const layoutKitStage: StageDefinition<Record<string, never>> = {
  id: "layout-kit",
  label: "Designing your post layouts",
  reads: ["personality", "expression", "content"],
  writes: ["expression"],
  async run(model, _input, { report }) {
    if (model.expression.layoutKit?.layouts?.length) {
      report({ id: "layout-kit", label: "Post layouts ready", status: "done" });
      return { patches: [] };
    }
    report({ id: "layout-kit", label: "Designing your post layouts", status: "info" });
    const fallback = defaultLayoutKit(model);
    let kit: LayoutKit = fallback;
    try {
      const r = await generateStructured(
        LayoutKitSchema,
        "You are a brand designer. Choose a small, consistent layout system for this brand's social posts, so every post is recognisably theirs.",
        `Available layouts:
${SELECTABLE_LAYOUTS.map((l) => `- ${l}: ${LAYOUT_NOTES[l]}`).join("\n")}

Return JSON:
{
  "layouts": ["5-7 layout ids from the list that suit this brand; include carousel-cover"],
  "radius": number (corner radius px at 1080 wide: 0 sharp/editorial, 12-20 friendly, 28-40 playful),
  "photoTreatment": "full" | "framed" | "duotone",
  "headlineCase": "upper" | "title" | "sentence",
  "accentShape": "none" | "bar" | "circle" | "underline" | "corner",
  "logoPosition": "top-left" | "top-right" | "bottom-left" | "bottom-right",
  "background": "primary" | "secondary" | "accent" | "neutral" (colour behind text-led layouts; must give strong contrast with text)
}
Base it on the brand's visual style, imagery style and personality above.`,
        { task: "creative", maxTokens: 600, cachedContext: toPromptContext(model) }
      );
      const layouts = [...new Set(r.layouts)].filter((l): l is LayoutId => (LAYOUT_IDS as readonly string[]).includes(l) && l !== "carousel-slide");
      if (!layouts.includes("carousel-cover")) layouts.push("carousel-cover");
      kit = { ...r, layouts: layouts.length >= 4 ? layouts.slice(0, 7) : fallback.layouts };
    } catch (err) {
      console.warn("[layout-kit] using default kit:", err instanceof Error ? err.message : err);
    }
    report({
      id: "layout-kit",
      label: `Chose ${kit.layouts.length} post layouts`,
      detail: kit.layouts.map((l) => LAYOUT_LABELS[l]).join(" · "),
      status: "done",
    });
    return { patches: [{ patch: { expression: { layoutKit: kit } }, options: { source: "generated", confidence: 0.6 } }] };
  },
};
