import type { Affluence, AgeGroup, Audience, Compliance, Gender, Moment, Motivation, Personality, Tone } from "./model";
import type { Platform } from "../types";

// ── UI labels (single source for questions, prompts and the brand profile) ──
export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "women", label: "Mostly women" },
  { value: "men", label: "Mostly men" },
  { value: "all", label: "Everyone" },
];

export const AGE_LABELS: Record<AgeGroup, string> = {
  "13-17": "13–17",
  "18-24": "18–24",
  "25-34": "25–34",
  "35-44": "35–44",
  "45-54": "45–54",
  "55+": "55+",
};

export const AFFLUENCE_OPTIONS: { value: Affluence; label: string; example: string }[] = [
  { value: "value", label: "Value", example: "Price matters most. Deals and combos get them to buy." },
  { value: "mid", label: "Mid-market", example: "They want good quality for a fair price." },
  { value: "premium", label: "Premium", example: "They pay more for better ingredients, design or service." },
  { value: "luxury", label: "Luxury", example: "Exclusivity and craft. Price is part of the appeal." },
];

export const MOTIVATION_LABELS: Record<Motivation, string> = {
  save_time_money: "Save time or money",
  status: "Look good / status",
  health: "Health & wellbeing",
  fun: "Fun & experiences",
  trust: "Trust & safety",
  belonging: "Belonging / community",
  self_improvement: "Self-improvement",
};

export const MOMENT_LABELS: Record<Moment, string> = {
  gifting: "Gifting",
  festivals: "Festivals",
  daily_routine: "Daily routine",
  weekends: "Weekends",
  special_occasions: "Special occasions",
  problem: "When a problem comes up",
  work_hours: "During work",
};

export const CITY_TIER_LABELS = { metro: "Metro cities", tier2: "Tier-2 cities", tier3: "Tier-3 towns", rural: "Rural" } as const;

export const LANGUAGE_OPTIONS = ["English", "Hindi", "Hinglish", "Marathi", "Tamil", "Telugu", "Bengali", "Gujarati", "Kannada", "Malayalam", "Punjabi"];

// ── Deterministic hints ────────────────────────────────────────────────────
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clampTone = (v: number) => Math.max(-1, Math.min(1, v));

/** Spending level nudges personality (and therefore palette): value → sincere/exciting, luxury → sophisticated. */
export function adjustPersonalityForAudience(p: Personality, a: Partial<Audience>): Personality {
  const shift: Record<Affluence, Partial<Personality>> = {
    value: { sincerity: 0.12, excitement: 0.1, sophistication: -0.2 },
    mid: { competence: 0.06 },
    premium: { sophistication: 0.15, competence: 0.05, excitement: -0.05 },
    luxury: { sophistication: 0.3, excitement: -0.12, ruggedness: -0.1 },
  };
  const s = a.affluence ? shift[a.affluence] : {};
  return {
    sincerity: clamp01(p.sincerity + (s.sincerity ?? 0)),
    excitement: clamp01(p.excitement + (s.excitement ?? 0)),
    competence: clamp01(p.competence + (s.competence ?? 0)),
    sophistication: clamp01(p.sophistication + (s.sophistication ?? 0)),
    ruggedness: clamp01(p.ruggedness + (s.ruggedness ?? 0)),
  };
}

const YOUNG: AgeGroup[] = ["13-17", "18-24"];
const OLDER: AgeGroup[] = ["35-44", "45-54", "55+"];

/** Age groups nudge voice: younger → casual/irreverent, 35+ → clearer/more formal. */
export function adjustToneForAudience(t: Tone, a: Partial<Audience>): Tone {
  const ages = a.ageGroups ?? [];
  const young = ages.filter((x) => YOUNG.includes(x)).length;
  const older = ages.filter((x) => OLDER.includes(x)).length;
  const lean = ages.length ? (young - older) / ages.length : 0; // -1 older … 1 younger
  const lux = a.affluence === "luxury" || a.affluence === "premium" ? 1 : 0;
  return {
    funny_serious: clampTone(t.funny_serious - 0.2 * lean + 0.15 * lux),
    formal_casual: clampTone(t.formal_casual + 0.3 * lean - 0.2 * lux),
    respectful_irreverent: clampTone(t.respectful_irreverent + 0.2 * lean - 0.2 * lux),
    enthusiastic_matter: clampTone(t.enthusiastic_matter - 0.1 * lean + 0.1 * lux),
  };
}

/** Default platforms in the Composer, weighted by age and B2B. */
export function defaultPlatforms(a: Partial<Audience>): Platform[] {
  if (a.buyerType === "b2b") return ["linkedin", "twitter"];
  const ages = a.ageGroups ?? [];
  const older = ages.some((x) => OLDER.includes(x));
  const young = ages.some((x) => YOUNG.includes(x) || x === "25-34");
  if (older && !young) return ["facebook", "instagram"];
  if (older && young) return ["instagram", "facebook"];
  return ["instagram"];
}

export function complianceFor(a: Partial<Audience>): Compliance {
  const minors = (a.ageGroups ?? []).includes("13-17");
  return {
    minorsInAudience: minors,
    restrictedTopics: minors ? ["alcohol", "gambling", "dieting or weight loss", "dating"] : [],
  };
}

/** Plain-English audience summary for prompts and cards. */
export function describeAudience(a: Partial<Audience>): string {
  const parts: string[] = [];
  if (a.gender) parts.push(GENDER_OPTIONS.find((g) => g.value === a.gender)!.label.toLowerCase());
  if (a.ageGroups?.length) parts.push(`aged ${a.ageGroups.map((x) => AGE_LABELS[x]).join(", ")}`);
  if (a.affluence) parts.push(`${AFFLUENCE_OPTIONS.find((o) => o.value === a.affluence)!.label.toLowerCase()} spenders`);
  if (a.markets?.cityTiers?.length) parts.push(`in ${a.markets.cityTiers.map((t) => CITY_TIER_LABELS[t].toLowerCase()).join(", ")}`);
  if (a.markets?.countries?.length) parts.push(`(${a.markets.countries.join(", ")})`);
  return parts.join(", ");
}
