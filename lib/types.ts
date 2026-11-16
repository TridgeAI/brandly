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
  /** Legacy flat projection of `model`, kept so existing pages and routes keep working. */
  dna: BrandDNA;
  /** Canonical Brand Model (see lib/brand/model.ts). */
  model?: import("./brand/model").BrandModel;
  sources: BrandSources;
  createdAt: string;
  updatedAt: string;
}

// ── Post ───────────────────────────────────────────────────────────────────
export type Platform = "instagram" | "facebook" | "linkedin" | "twitter";
export type PostStatus = "draft" | "scheduled" | "published" | "failed";

export interface VisualBrief {
  subject: string;
  setting: string;
  lighting: string;
  composition: string;
  /** True when a real product/brand photo fits better than a generated one. */
  usesProductPhoto: boolean;
}

export interface CarouselSlide {
  headline: string;
  body?: string;
}

/** The branded image(s) made for a post by /api/render-post. */
export interface RenderedMedia {
  layout: import("./brand/model").LayoutId;
  /** Storage paths in the `images` bucket, one per slide. */
  paths: string[];
  /** Signed URLs for display (re-signed from `paths` before publishing). */
  urls: string[];
  size: "1080x1350" | "1080x1080";
  /** The photo used inside the layout (brand photo path or generated image URL). */
  photo?: { kind: "brand" | "generated"; ref: string };
}

export interface GeneratedPost {
  caption: string;
  hashtags: string[];
  /** Plain-text image prompt, derived from visualBrief for older code paths. */
  imagePrompt: string;
  cta: string;
  bestTimeToPost: string;
  postType: string;
  platformVariants: Partial<Record<Platform, string>>;
  // ── generate-post@2 ──
  /** Content format id from lib/content/brief.ts (e.g. "myth-vs-fact"). */
  format?: string;
  /** Hook style id (e.g. "question"). */
  hook?: string;
  pillar?: string;
  /** ≤ 8 words, shown on the visual. */
  headline?: string;
  subline?: string;
  /** Short lines for checklist / steps / myth-fact layouts. */
  items?: string[];
  /** A single number for stat layouts, e.g. "73%". */
  stat?: string;
  slides?: CarouselSlide[];
  visualBrief?: VisualBrief;
  /** Layout chosen for the visual. */
  layout?: import("./brand/model").LayoutId;
  rendered?: RenderedMedia;
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
  /** llm_calls.id of the generation this post came from (for feedback + quality tracking). */
  generationId?: string;
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
  /** When present, the richer model is used for the prompt (and prompt caching). */
  brandModel?: import("./brand/model").BrandModel;
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
