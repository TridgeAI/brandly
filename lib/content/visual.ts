// Turns a post's structured visual brief into an image-model prompt.
// Exact colours, fonts and the logo come from the branded layout, so the photo
// only needs to be in tone: colours are described in words (models ignore hex).
import type { BrandModel } from "@/lib/brand/model";
import { paletteToWords } from "@/lib/brand/color";
import type { BrandDNA, VisualBrief } from "@/lib/types";

export function imagePromptFromBrief(brief: VisualBrief | undefined, model?: BrandModel, dna?: BrandDNA, fallback = ""): string {
  if (!brief || !(brief.subject || brief.setting)) return fallback;
  const c = model?.expression.tokens.color;
  const hexes = c ? [c.primary.$value, c.secondary.$value, c.accent.$value] : dna ? [dna.colors.primary, dna.colors.secondary, dna.colors.accent] : [];
  const colours = paletteToWords(hexes);
  const imagery = model?.expression.imageryStyle || dna?.visual_style || "";
  const assets = model?.expression.distinctiveAssets?.slice(0, 2) ?? [];
  const vibe = (model?.content.vibe ?? dna?.vibe ?? []).slice(0, 3);
  return [
    `Photograph: ${brief.subject}.`,
    brief.setting && `Setting: ${brief.setting}.`,
    brief.lighting && `Lighting: ${brief.lighting}.`,
    brief.composition && `Composition: ${brief.composition}. Leave calm, uncluttered space for a headline.`,
    imagery && `Style: ${imagery}.`,
    colours.length && `Colour mood: ${colours.join(", ")} tones.`,
    vibe.length && `Mood: ${vibe.join(", ")}.`,
    assets.length && `Brand cues: ${assets.join("; ")}.`,
    "Realistic, natural, not stock-photo looking. No text, letters, logos or watermarks.",
  ]
    .filter(Boolean)
    .join(" ");
}
