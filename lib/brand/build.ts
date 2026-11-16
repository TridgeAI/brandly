import type { ModelPatch } from "./model";
import type { Direction } from "./stages/directions";

/** Turns a chosen Build direction into a model patch (applied with source "user"). */
export function directionToPatch(d: Direction): ModelPatch {
  const color = (hex: string) => ({ $type: "color" as const, $value: hex });
  return {
    personality: d.personality,
    identity: { oneLiner: d.oneLiner },
    expression: {
      tokens: {
        color: {
          primary: color(d.palette.primary),
          secondary: color(d.palette.secondary),
          accent: color(d.palette.accent),
          neutral: color(d.palette.neutral),
        },
        font: {
          heading: { $type: "fontFamily", $value: d.fonts.heading },
          body: { $type: "fontFamily", $value: d.fonts.body },
        },
      },
      typographyFeel: d.fonts.feel,
      imageryStyle: d.imageryStyle,
      visualStyle: d.summary,
    },
    voice: { tone: d.tone, description: d.voiceDescription, sampleLines: d.sampleLines },
    content: { vibe: d.vibe.length ? d.vibe : d.words },
  };
}
