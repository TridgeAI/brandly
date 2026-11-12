import type { Personality, PersonalityKey } from "./model";

// "This or that" pairs. Each side adds weight to Aaker dimensions.
// Scoring is plain code, so it's instant, free and explainable.
export interface ThisOrThatOption {
  label: string;
  example: string;
  weights: Partial<Record<PersonalityKey, number>>;
}
export interface ThisOrThatPair {
  id: string;
  question: string;
  a: ThisOrThatOption;
  b: ThisOrThatOption;
}

export const THIS_OR_THAT: ThisOrThatPair[] = [
  {
    id: "energy",
    question: "Your brand feels more…",
    a: { label: "Calm", example: "“Take your time. We'll be here.”", weights: { sincerity: 1, sophistication: 0.5 } },
    b: { label: "Energetic", example: "“Drop everything. This just landed.”", weights: { excitement: 1.2 } },
  },
  {
    id: "talk",
    question: "When you talk to customers, you sound like…",
    a: { label: "A friend", example: "“Honestly? You're going to love this.”", weights: { sincerity: 1.1 } },
    b: { label: "An expert", example: "“Three things to check before you buy.”", weights: { competence: 1.2 } },
  },
  {
    id: "look",
    question: "Your look is closer to…",
    a: { label: "Clean & minimal", example: "Lots of white space, few colours", weights: { sophistication: 1, competence: 0.4 } },
    b: { label: "Bold & colourful", example: "Big type, bright colours, busy", weights: { excitement: 1 } },
  },
  {
    id: "roots",
    question: "Which word fits better?",
    a: { label: "Handmade", example: "Craft, natural materials, roots", weights: { ruggedness: 0.9, sincerity: 0.6 } },
    b: { label: "Modern", example: "New, fast, tech-forward", weights: { competence: 0.7, excitement: 0.6 } },
  },
  {
    id: "price",
    question: "You want people to feel…",
    a: { label: "It's a great deal", example: "“Best value in town.”", weights: { sincerity: 0.8, excitement: 0.4 } },
    b: { label: "It's worth it", example: "“Made to last. Priced for it.”", weights: { sophistication: 1.1 } },
  },
  {
    id: "humour",
    question: "Jokes in your posts?",
    a: { label: "Yes, often", example: "Memes, puns, playful replies", weights: { excitement: 0.9, sincerity: 0.3 } },
    b: { label: "Rarely", example: "Warm, but mostly straightforward", weights: { competence: 0.7, sophistication: 0.4 } },
  },
  {
    id: "setting",
    question: "Your brand would rather be…",
    a: { label: "Outdoors", example: "Trails, workshops, real life", weights: { ruggedness: 1.2 } },
    b: { label: "In the city", example: "Cafés, studios, rooftops", weights: { sophistication: 0.7, excitement: 0.5 } },
  },
  {
    id: "promise",
    question: "Customers come back because you're…",
    a: { label: "Reliable", example: "Same great thing, every time", weights: { competence: 1, sincerity: 0.5 } },
    b: { label: "Surprising", example: "Always something new", weights: { excitement: 1.1 } },
  },
];

/** answers: pairId → "a" | "b" | undefined (skipped). Returns scores 0–1. */
export function scorePersonality(answers: Record<string, "a" | "b" | undefined>): Personality {
  const keys: PersonalityKey[] = ["sincerity", "excitement", "competence", "sophistication", "ruggedness"];
  const raw = Object.fromEntries(keys.map((k) => [k, 0])) as Record<PersonalityKey, number>;
  const max = Object.fromEntries(keys.map((k) => [k, 0])) as Record<PersonalityKey, number>;
  for (const pair of THIS_OR_THAT) {
    const pick = answers[pair.id];
    if (!pick) continue;
    for (const k of keys) {
      raw[k] += pair[pick].weights[k] ?? 0;
      // Best case for this dimension among the pairs actually answered.
      max[k] += Math.max(pair.a.weights[k] ?? 0, pair.b.weights[k] ?? 0);
    }
  }
  const out = {} as Personality;
  // Floor of 0.15 keeps unanswered dimensions from producing extreme palettes.
  for (const k of keys) out[k] = max[k] ? Math.round((0.15 + 0.85 * (raw[k] / max[k])) * 100) / 100 : 0.3;
  return out;
}

export const PERSONALITY_WORDS: Record<PersonalityKey, string[]> = {
  sincerity: ["warm", "honest", "down-to-earth"],
  excitement: ["bold", "playful", "lively"],
  competence: ["reliable", "smart", "precise"],
  sophistication: ["refined", "elegant", "considered"],
  ruggedness: ["earthy", "tough", "outdoorsy"],
};
