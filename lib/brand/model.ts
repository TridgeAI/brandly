// ── Canonical Brand Model ───────────────────────────────────────────────────
// One model for every brand, whether its identity was extracted from existing
// sources (Door A, "analyse") or built from scratch (Door B, "build").
// Layers follow established brand frameworks:
//   strategy    → STP / positioning
//   identity    → Kapferer Brand Identity Prism
//   personality → Aaker (1997) brand personality dimensions
//   expression  → W3C Design Tokens (DTCG 2025.10) shaped visual tokens
//   voice       → NN/g four dimensions of tone
//   content     → pillars + Ehrenberg-Bass category entry points / distinctive assets

export type BrandMode = "analyse" | "build" | "refine";

export type Gender = "women" | "men" | "all";
export type AgeGroup = "13-17" | "18-24" | "25-34" | "35-44" | "45-54" | "55+";
export type Affluence = "value" | "mid" | "premium" | "luxury";
export type CityTier = "metro" | "tier2" | "tier3" | "rural";

export const AGE_GROUPS: AgeGroup[] = ["13-17", "18-24", "25-34", "35-44", "45-54", "55+"];

export const MOTIVATIONS = [
  "save_time_money",
  "status",
  "health",
  "fun",
  "trust",
  "belonging",
  "self_improvement",
] as const;
export type Motivation = (typeof MOTIVATIONS)[number];

export const MOMENTS = [
  "gifting",
  "festivals",
  "daily_routine",
  "weekends",
  "special_occasions",
  "problem",
  "work_hours",
] as const;
export type Moment = (typeof MOMENTS)[number];

export interface Audience {
  gender?: Gender;
  ageGroups: AgeGroup[];
  affluence?: Affluence;
  markets: { countries: string[]; cityTiers: CityTier[] };
  languages: string[];
  motivations: Motivation[];
  moments: Moment[];
  // Optional, asked later (Refine)
  buyerType?: "b2c" | "b2b";
  buyerIsUser?: boolean;
  lifeStages?: string[];
  channels?: string[];
  interests?: string[];
  objections?: string[];
  psychographic: string;
  notes?: string;
}

export interface Strategy {
  category: string;
  offering: string; // what they sell, in plain words
  audience: Audience;
  problem: string;
  promise: string;
  differentiators: string[];
  proofPoints: string[];
  competitors: string[];
}

export interface Prism {
  physique: string;
  personality: string;
  culture: string;
  relationship: string;
  reflection: string;
  selfImage: string;
}

export interface Identity {
  prism: Prism;
  archetype?: string;
  mission: string;
  oneLiner: string;
}

/** Aaker dimensions, each 0–1. */
export interface Personality {
  sincerity: number;
  excitement: number;
  competence: number;
  sophistication: number;
  ruggedness: number;
}
export type PersonalityKey = keyof Personality;
export const PERSONALITY_KEYS: PersonalityKey[] = [
  "sincerity",
  "excitement",
  "competence",
  "sophistication",
  "ruggedness",
];

/** DTCG-shaped token, simplified to the fields Brandly needs. */
export interface ColorToken {
  $type: "color";
  $value: string; // hex
}
export interface FontToken {
  $type: "fontFamily";
  $value: string;
}

export interface Expression {
  tokens: {
    color: {
      primary: ColorToken;
      secondary: ColorToken;
      accent: ColorToken;
      neutral: ColorToken;
    };
    font: {
      heading: FontToken;
      body: FontToken;
    };
  };
  typographyFeel: string;
  visualStyle: string;
  imageryStyle: string;
  logoUrl?: string;
  logoNotes?: string;
  distinctiveAssets: string[];
}

/** NN/g tone dimensions, each -1..1. */
export interface Tone {
  funny_serious: number; // -1 funny … 1 serious
  formal_casual: number; // -1 formal … 1 casual
  respectful_irreverent: number; // -1 respectful … 1 irreverent
  enthusiastic_matter: number; // -1 enthusiastic … 1 matter-of-fact
}

export interface Voice {
  tone: Tone;
  description: string;
  vocabulary: { use: string[]; avoid: string[] };
  sampleLines: string[];
}

export interface Content {
  pillars: string[];
  categoryEntryPoints: string[];
  hashtagClusters: string[];
  do: string[];
  dont: string[];
  vibe: string[];
  productsServices: string[];
}

export type FieldSource = "extracted" | "inferred" | "user" | "generated";

export interface FieldMeta {
  source: FieldSource;
  confidence: number; // 0–1
  locked: boolean;
  evidence?: string;
  updatedAt?: string;
}

export interface Evidence {
  source: "website" | "instagram" | "pdf" | "upload";
  url?: string;
  summary: string;
  colors?: string[];
  fonts?: string[];
  logoUrl?: string;
  copySample?: string;
  capturedAt: string;
}

export interface Compliance {
  minorsInAudience: boolean;
  restrictedTopics: string[];
}

export interface BrandModel {
  id: string;
  name: string;
  mode: BrandMode;
  version: number;
  createdAt: string;
  updatedAt: string;
  strategy: Strategy;
  identity: Identity;
  personality: Personality;
  expression: Expression;
  voice: Voice;
  content: Content;
  /** Keyed by dotted field path, e.g. "expression.tokens.color.primary". */
  meta: Record<string, FieldMeta>;
  evidence: Evidence[];
  compliance: Compliance;
}

export type LayerKey = "strategy" | "identity" | "personality" | "expression" | "voice" | "content";

/** Deep-partial helper for stage patches. */
export type DeepPartial<T> = T extends (infer U)[]
  ? U[]
  : T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

export type ModelPatch = DeepPartial<Pick<BrandModel, LayerKey | "name">>;

const color = (hex: string): ColorToken => ({ $type: "color", $value: hex });
const font = (name: string): FontToken => ({ $type: "fontFamily", $value: name });

export function emptyModel(name: string, mode: BrandMode, id: string = crypto.randomUUID()): BrandModel {
  const now = new Date().toISOString();
  return {
    id,
    name,
    mode,
    version: 1,
    createdAt: now,
    updatedAt: now,
    strategy: {
      category: "",
      offering: "",
      audience: {
        ageGroups: [],
        markets: { countries: [], cityTiers: [] },
        languages: [],
        motivations: [],
        moments: [],
        psychographic: "",
      },
      problem: "",
      promise: "",
      differentiators: [],
      proofPoints: [],
      competitors: [],
    },
    identity: {
      prism: { physique: "", personality: "", culture: "", relationship: "", reflection: "", selfImage: "" },
      mission: "",
      oneLiner: "",
    },
    personality: { sincerity: 0.5, excitement: 0.5, competence: 0.5, sophistication: 0.5, ruggedness: 0.2 },
    expression: {
      tokens: {
        color: {
          primary: color("#1C1917"),
          secondary: color("#57534E"),
          accent: color("#D97706"),
          neutral: color("#F5F5F4"),
        },
        font: { heading: font("Inter"), body: font("Inter") },
      },
      typographyFeel: "",
      visualStyle: "",
      imageryStyle: "",
      distinctiveAssets: [],
    },
    voice: {
      tone: { funny_serious: 0, formal_casual: 0, respectful_irreverent: -0.4, enthusiastic_matter: 0 },
      description: "",
      vocabulary: { use: [], avoid: [] },
      sampleLines: [],
    },
    content: {
      pillars: [],
      categoryEntryPoints: [],
      hashtagClusters: [],
      do: [],
      dont: [],
      vibe: [],
      productsServices: [],
    },
    meta: {},
    evidence: [],
    compliance: { minorsInAudience: false, restrictedTopics: [] },
  };
}
