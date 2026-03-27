// ── Brand ──────────────────────────────────────────────────────────────────
export interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
  neutral: string;
}

export interface BrandDNA {
  brandName: string;
  colors: BrandColors;
  typography_feel: string;
  visual_style: string;
  vibe: string[];
  products_services: string[];
  target_audience: string;
  communication_tone: string;
  content_themes: string[];
  hashtag_clusters: string[];
  do: string[];
  dont: string[];
  one_liner: string;
}

export interface BrandSources {
  website?: string;
  instagram?: string;
  pdfName?: string;
  pdfPages?: number;
}

export interface Brand {
  id: string;
  name: string;
  dna: BrandDNA;
  sources: BrandSources;
  createdAt: string;
  updatedAt: string;
}

// ── Post ───────────────────────────────────────────────────────────────────
export type Platform = "instagram" | "facebook" | "linkedin" | "twitter";
export type PostStatus = "draft" | "scheduled" | "published" | "failed";

export interface GeneratedPost {
  caption: string;
  hashtags: string[];
  imagePrompt: string;
  cta: string;
  bestTimeToPost: string;
  postType: string;
  platformVariants: Partial<Record<Platform, string>>;
}

export interface ScheduledPost {
  id: string;
  brandId: string;
  content: GeneratedPost;
  platforms: Platform[];
  scheduledAt: string;
  status: PostStatus;
  createdAt: string;
  mediaUrl?: string;
  notes?: string;
}

// ── Content Templates ──────────────────────────────────────────────────────
export type TemplateCategory =
  | "product_launch"
  | "announcement"
  | "engagement"
  | "educational"
  | "behind_scenes"
  | "testimonial"
  | "seasonal"
  | "ugc";

export interface ContentTemplate {
  id: TemplateCategory;
  label: string;
  icon: string;
  description: string;
  promptHint: string;
}

// ── Automation ─────────────────────────────────────────────────────────────
export type TriggerType = "rss" | "recurring" | "product_update" | "keyword";
export type TriggerStatus = "active" | "paused" | "error";

export interface RssTrigger {
  type: "rss";
  feedUrl: string;
  checkIntervalHours: number;
}

export interface RecurringTrigger {
  type: "recurring";
  intervalDays: number;
  timeOfDay: string; // "HH:MM"
  topic?: string;
}

export interface ProductUpdateTrigger {
  type: "product_update";
  sourceUrl: string;
}

export type TriggerConfig = RssTrigger | RecurringTrigger | ProductUpdateTrigger;

export interface AutomationRule {
  id: string;
  brandId: string;
  name: string;
  trigger: TriggerConfig;
  platforms: Platform[];
  status: TriggerStatus;
  lastRun?: string;
  nextRun?: string;
  postsGenerated: number;
  createdAt: string;
}

// ── API Payloads ───────────────────────────────────────────────────────────
export interface AnalyseBrandPayload {
  brandName: string;
  websiteUrl?: string;
  igHandle?: string;
  pdfInsights?: Record<string, unknown>;
}

export interface GeneratePostPayload {
  brandDNA: BrandDNA;
  template: TemplateCategory;
  topic?: string;
  platforms: Platform[];
  tone?: string;
  additionalContext?: string;
}

export interface AnalysePdfPayload {
  pages: string[]; // base64 JPEG strings
  brandName: string;
}
