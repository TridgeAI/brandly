import { z } from "zod";
import { generateStructured } from "../../llm";
import { personalityToPalette, rankPersonality, type Palette } from "../color";
import { adjustPersonalityForAudience, adjustToneForAudience } from "../audience";
import { toPromptContext } from "../projection";
import { PERSONALITY_WORDS } from "../personality";
import type { Personality, PersonalityKey, Tone } from "../model";
import type { StageDefinition } from "./types";
import { FONT_PAIRS } from "../fonts";

export { FONT_PAIRS };


const signed = z.coerce.number().min(-1).max(1).catch(0);
const DirectionsSchema = z.object({
  directions: z
    .array(
      z.object({
        name: z.string().catch("Direction"),
        summary: z.string().catch(""),
        oneLiner: z.string().catch(""),
        fontPairId: z.string().catch("fraunces-inter"),
        tone: z
          .object({ funny_serious: signed, formal_casual: signed, respectful_irreverent: signed, enthusiastic_matter: signed })
          .catch({ funny_serious: 0, formal_casual: 0, respectful_irreverent: 0, enthusiastic_matter: 0 }),
        voiceDescription: z.string().catch(""),
        sampleLines: z.array(z.string()).catch([]),
        sampleCaption: z.string().catch(""),
        imageryStyle: z.string().catch(""),
        vibe: z.array(z.string()).catch([]),
      })
    )
    .min(1),
});

export interface Direction {
  id: string;
  name: string;
  summary: string;
  words: string[];
  oneLiner: string;
  personality: Personality;
  palette: Palette;
  fonts: { heading: string; body: string; feel: string };
  tone: Tone;
  voiceDescription: string;
  sampleLines: string[];
  sampleCaption: string;
  imageryStyle: string;
  vibe: string[];
}

const boost = (p: Personality, k: PersonalityKey, by: number): Personality => ({ ...p, [k]: Math.min(1, p[k] + by) });

/** Three meaningfully different directions from one personality: as answered, then leaning on 1st and 2nd traits. */
/**
 * Three meaningfully different directions: each one is led by a different one of
 * the brand's top three traits (the others are toned down), so palettes and
 * fonts actually differ even when several traits score high.
 */
function variants(base: Personality): Personality[] {
  const ranked = rankPersonality(base);
  return ranked.slice(0, 3).map((lead) => {
    const p = { ...base };
    for (const k of Object.keys(p) as PersonalityKey[]) if (k !== lead) p[k] = Math.max(0.1, p[k] * 0.55);
    return boost(p, lead, 1);
  });
}

export const directionsStage: StageDefinition<{ seed?: number }> = {
  id: "directions",
  label: "Designing three directions",
  reads: ["strategy", "personality"],
  writes: [],
  async run(model, input, { report }) {
    const seed = input.seed ?? 1;
    const audience = model.strategy.audience;
    const base = adjustPersonalityForAudience(model.personality, audience);
    const people = variants(base);
    const palettes = people.map((p, i) => personalityToPalette(p, seed * 10 + i + 1));
    const words = people.map((p) => {
      const [a, b] = rankPersonality(p);
      return [PERSONALITY_WORDS[a][0], PERSONALITY_WORDS[a][1], PERSONALITY_WORDS[b][0]];
    });

    report({ id: "directions", label: "Designing three directions", status: "info", swatches: palettes.flatMap((p) => [p.primary, p.accent]) });

    const r = await generateStructured(
      DirectionsSchema,
      "You are a brand designer creating starting directions for a new small business. Each direction must feel clearly different. Write like a human, never like an AI. Avoid words like 'elevate', 'unleash', 'seamless'.",
      `Create exactly 3 directions. Their personality emphasis is fixed:
${people.map((p, i) => `${i + 1}. feels ${words[i].join(", ")}; palette primary ${palettes[i].primary}, accent ${palettes[i].accent}`).join("\n")}

Pick a font pair for each from this list (use the id): ${FONT_PAIRS.map((f) => `${f.id} (${f.feel})`).join("; ")}.
Use different font pairs for the 3 directions.
Write captions in the audience's post language if one is given (Hinglish = Hindi in Latin script mixed with English).

Return JSON:
{"directions": [{
  "name": "2-3 word name, e.g. 'Warm everyday'",
  "summary": "one sentence a business owner understands",
  "oneLiner": "brand one-liner under 12 words",
  "fontPairId": "id from the list",
  "tone": {"funny_serious": -1..1, "formal_casual": -1..1, "respectful_irreverent": -1..1, "enthusiastic_matter": -1..1},
  "voiceDescription": "2 sentences",
  "sampleLines": ["3 short lines in this voice"],
  "sampleCaption": "one Instagram caption, 1-3 sentences, max 2 hashtags",
  "imageryStyle": "one sentence on photo style",
  "vibe": ["4 words"]
}]}`,
      { task: "creative", maxTokens: 2200, cachedContext: toPromptContext(model) }
    );

    const directions: Direction[] = people.map((p, i) => {
      const d = r.directions[i] ?? r.directions[0];
      const fonts = FONT_PAIRS.find((f) => f.id === d.fontPairId) ?? FONT_PAIRS[i % FONT_PAIRS.length];
      return {
        id: `dir_${i + 1}`,
        name: d.name,
        summary: d.summary,
        words: words[i],
        oneLiner: d.oneLiner,
        personality: p,
        palette: palettes[i],
        fonts: { heading: fonts.heading, body: fonts.body, feel: fonts.feel },
        tone: adjustToneForAudience(d.tone, audience),
        voiceDescription: d.voiceDescription,
        sampleLines: d.sampleLines.slice(0, 3),
        sampleCaption: d.sampleCaption,
        imageryStyle: d.imageryStyle,
        vibe: d.vibe,
      };
    });

    report({ id: "directions", label: "Three directions ready", status: "done", swatches: palettes.flatMap((p) => [p.primary, p.accent]) });
    return { patches: [], output: { directions } };
  },
};
