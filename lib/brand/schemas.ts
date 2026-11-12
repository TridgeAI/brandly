import { z } from "zod";
import { AGE_GROUPS, MOMENTS, MOTIVATIONS } from "./model";

// Lenient schemas: cheap models sometimes drop or mistype fields, so every
// field falls back to a safe default instead of failing the whole stage.
const str = z.string().catch("");
const strArr = z.array(z.string()).catch([]);
const unit = z.coerce.number().min(0).max(1).catch(0.5);
const signed = z.coerce.number().min(-1).max(1).catch(0);
const hex = z
  .string()
  .regex(/^#?[0-9a-fA-F]{6}$/)
  .transform((h) => (h.startsWith("#") ? h : `#${h}`).toUpperCase())
  .optional()
  .catch(undefined);

/** Keeps only valid enum values instead of rejecting the whole array. */
function enumArr<T extends string>(values: readonly T[], max = 20) {
  return z
    .array(z.string())
    .catch([])
    .transform((arr) => [...new Set(arr.map((v) => v.trim().toLowerCase()))].filter((v): v is T => (values as readonly string[]).includes(v)).slice(0, max));
}

export const AudienceSchema = z.object({
  gender: z.enum(["women", "men", "all"]).optional().catch(undefined),
  ageGroups: enumArr(AGE_GROUPS),
  affluence: z.enum(["value", "mid", "premium", "luxury"]).optional().catch(undefined),
  countries: strArr,
  cityTiers: enumArr(["metro", "tier2", "tier3", "rural"] as const),
  languages: strArr,
  motivations: enumArr(MOTIVATIONS, 2),
  moments: enumArr(MOMENTS),
  psychographic: str,
});

export const ExtractSchema = z.object({
  oneLiner: str,
  offering: str,
  category: str,
  problem: str,
  promise: str,
  differentiators: strArr,
  prism: z
    .object({
      physique: str,
      personality: str,
      culture: str,
      relationship: str,
      reflection: str,
      selfImage: str,
    })
    .catch({ physique: "", personality: "", culture: "", relationship: "", reflection: "", selfImage: "" }),
  archetype: str,
  personality: z
    .object({ sincerity: unit, excitement: unit, competence: unit, sophistication: unit, ruggedness: unit })
    .catch({ sincerity: 0.5, excitement: 0.5, competence: 0.5, sophistication: 0.5, ruggedness: 0.2 }),
  colors: z.object({ primary: hex, secondary: hex, accent: hex, neutral: hex }).catch({
    primary: undefined,
    secondary: undefined,
    accent: undefined,
    neutral: undefined,
  }),
  headingFont: str,
  bodyFont: str,
  typographyFeel: str,
  visualStyle: str,
  imageryStyle: str,
  tone: z
    .object({ funny_serious: signed, formal_casual: signed, respectful_irreverent: signed, enthusiastic_matter: signed })
    .catch({ funny_serious: 0, formal_casual: 0, respectful_irreverent: 0, enthusiastic_matter: 0 }),
  voiceDescription: str,
  vocabularyUse: strArr,
  vocabularyAvoid: strArr,
  sampleLines: strArr,
  audience: AudienceSchema.catch({
    ageGroups: [],
    countries: [],
    cityTiers: [],
    languages: [],
    motivations: [],
    moments: [],
    psychographic: "",
  }),
  /** How sure the model is about the audience guess (0–1). */
  audienceConfidence: unit,
  vibe: strArr,
  productsServices: strArr,
  pillars: strArr,
  hashtagClusters: strArr,
  do: strArr,
  dont: strArr,
});
export type ExtractResult = z.infer<typeof ExtractSchema>;

export const ContentSystemSchema = z.object({
  pillars: strArr,
  categoryEntryPoints: strArr,
  hashtagClusters: strArr,
  do: strArr,
  dont: strArr,
});
export type ContentSystemResult = z.infer<typeof ContentSystemSchema>;

export const VisualInsightsSchema = z.object({
  colors: z.array(z.string()).catch([]),
  visualStyle: str,
  typographyFeel: str,
  vibe: strArr,
  productsServices: strArr,
  motifs: str,
  audienceHints: str,
  tone: str,
});
export type VisualInsights = z.infer<typeof VisualInsightsSchema>;
