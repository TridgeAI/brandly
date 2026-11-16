// Picks what a post will be BEFORE the model writes it: format, hook, pillar,
// entry point and moment. Rule-based (no LLM cost). The least recently used
// option wins, so consecutive posts differ in shape, not just in words.
import type { BrandModel, LayoutId, LayoutKit } from "@/lib/brand/model";
import { MOMENT_LABELS } from "@/lib/brand/audience";
import type { TemplateCategory } from "@/lib/types";
import type { ContentHistory } from "./history";

export interface PostFormat {
  id: string;
  label: string;
  /** How to write it. Sent to the model as a fixed instruction. */
  instruction: string;
  /** Templates this format suits. */
  templates: TemplateCategory[];
  /** Layouts that suit this format, best first. */
  layouts: LayoutId[];
  /** A real product photo suits it better than a generated scene. */
  usesProductPhoto?: boolean;
  /** Can be split into carousel slides. */
  carousel?: boolean;
  /** What the visual fields must contain. */
  visualText: string;
}

export const FORMATS: PostFormat[] = [
  {
    id: "myth-vs-fact",
    label: "Myth vs fact",
    instruction: "Name one common belief in this category, then correct it with the real fact and why it matters.",
    templates: ["educational", "engagement", "product_launch"],
    layouts: ["myth-fact", "split", "quote"],
    carousel: true,
    visualText: 'items = ["<the myth, max 10 words>", "<the fact, max 12 words>"]. headline = a short label like "Myth vs fact" in brand words.',
  },
  {
    id: "how-to",
    label: "How-to steps",
    instruction: "Teach one specific, useful thing in 3-5 short numbered steps. Concrete actions, no filler.",
    templates: ["educational", "product_launch", "behind_scenes"],
    layouts: ["checklist", "carousel-cover", "split"],
    carousel: true,
    visualText: "items = the steps, max 7 words each. headline = what they will be able to do.",
  },
  {
    id: "single-stat",
    label: "Single stat",
    instruction: "Build the post around ONE striking number (from the brand facts or a widely known, non-fabricated figure). Explain what it means for the reader.",
    templates: ["educational", "announcement", "testimonial", "product_launch"],
    layouts: ["big-number", "split"],
    visualText: 'stat = the number only (e.g. "3x", "72%", "10,000"). headline = what the number is about, max 8 words. Never invent precise statistics about third parties; if unsure, use a number about the brand itself.',
  },
  {
    id: "opinion",
    label: "Quote / opinion",
    instruction: "Take a clear, defensible point of view the brand believes. Say it plainly, then back it up in 2-3 sentences.",
    templates: ["engagement", "educational", "seasonal", "announcement"],
    layouts: ["quote", "full-bleed"],
    visualText: "headline = the opinion as a short quotable line, max 12 words. subline = who says it (the brand or founder).",
  },
  {
    id: "product-spotlight",
    label: "Product spotlight",
    instruction: "Focus on one product or service: what it is, the one detail people miss, and who it is for.",
    templates: ["product_launch", "announcement", "ugc", "seasonal", "testimonial"],
    layouts: ["framed", "photo-band", "split", "full-bleed"],
    usesProductPhoto: true,
    visualText: "headline = the product's single best benefit, max 8 words. subline = the product name.",
  },
  {
    id: "before-after",
    label: "Before / after",
    instruction: "Contrast life before and after the product or idea. Make both sides concrete and recognisable.",
    templates: ["testimonial", "product_launch", "educational"],
    layouts: ["split", "myth-fact"],
    carousel: true,
    visualText: 'items = ["Before: <max 8 words>", "After: <max 8 words>"]. headline = the change, max 8 words.',
  },
  {
    id: "pov",
    label: "POV",
    instruction: 'Write from the reader\'s point of view in a relatable everyday moment (a "POV:" style setup), then land the brand naturally.',
    templates: ["engagement", "behind_scenes", "ugc", "seasonal"],
    layouts: ["full-bleed", "photo-band"],
    visualText: 'headline = the POV line, max 10 words (may start with "POV:").',
  },
  {
    id: "checklist",
    label: "Checklist",
    instruction: "Give a short checklist the reader can save: 3-5 items, each one line and specific.",
    templates: ["educational", "seasonal", "product_launch", "engagement"],
    layouts: ["checklist", "carousel-cover"],
    carousel: true,
    visualText: "items = the checklist items, max 6 words each. headline = what the checklist is for.",
  },
  {
    id: "customer-question",
    label: "Customer question",
    instruction: "Answer one real question a customer would ask before buying. Quote the question, then answer it honestly.",
    templates: ["engagement", "testimonial", "educational", "product_launch"],
    layouts: ["quote", "split"],
    visualText: "headline = the customer's question in their words, max 12 words. subline = a 5-8 word answer teaser.",
  },
  {
    id: "behind-the-scenes",
    label: "Behind the scenes",
    instruction: "Show one specific part of how the work gets done: a person, a step, a tool, a mistake. Process over polish.",
    templates: ["behind_scenes", "announcement", "ugc"],
    layouts: ["full-bleed", "photo-band", "framed"],
    visualText: "headline = what we are showing, max 8 words.",
  },
  {
    id: "comparison",
    label: "Comparison",
    instruction: "Compare two options the audience weighs up (not a named competitor). Be fair, then say who each is for.",
    templates: ["educational", "product_launch"],
    layouts: ["split", "myth-fact", "checklist"],
    carousel: true,
    visualText: 'items = ["<option A: max 8 words>", "<option B: max 8 words>"]. headline = the question being compared.',
  },
  {
    id: "mistake",
    label: "Mistake to avoid",
    instruction: "Name one common mistake the audience makes, why it happens, and the simple fix.",
    templates: ["educational", "engagement"],
    layouts: ["quote", "big-number", "checklist"],
    visualText: 'headline = the mistake, max 8 words. subline = the fix in max 8 words. stat may be "1" or a count if the post lists mistakes.',
  },
  {
    id: "mini-story",
    label: "Mini story",
    instruction: "Tell a 4-6 sentence true-to-life story (a customer, a maker, a day). Start in the middle of the action. End with what changed.",
    templates: ["testimonial", "behind_scenes", "ugc", "announcement", "seasonal"],
    layouts: ["full-bleed", "photo-band", "quote"],
    visualText: "headline = the story's turning point in max 8 words.",
  },
  {
    id: "offer",
    label: "Offer",
    instruction: "Make one clear offer: what they get, until when, and how to get it. Short and specific, no hype words.",
    templates: ["product_launch", "seasonal", "announcement"],
    layouts: ["framed", "photo-band", "big-number"],
    usesProductPhoto: true,
    visualText: 'headline = the offer in max 6 words. stat = the deal if numeric (e.g. "20% off"). subline = the deadline or condition.',
  },
];

export interface HookStyle {
  id: string;
  instruction: string;
}

export const HOOKS: HookStyle[] = [
  { id: "question", instruction: "Open with a direct question the reader would answer yes to. Not 'Did you know'." },
  { id: "bold-claim", instruction: "Open with a short, confident statement (max 8 words) the brand can stand behind." },
  { id: "number", instruction: "Open with a specific number (a count, time, amount or percentage)." },
  { id: "contrarian", instruction: "Open by disagreeing with common advice in the category, then earn it." },
  { id: "story", instruction: "Open mid-scene with a concrete moment: who, where, what happened. No setup sentence." },
  { id: "if-you", instruction: "Open with 'If you…' naming a specific situation the audience is in." },
];

/** Words that make captions read as AI-written. Merged with the brand's own "avoid" list. */
export const AI_CLICHES = [
  "elevate",
  "unlock",
  "unleash",
  "game-changer",
  "game changer",
  "in today's fast-paced world",
  "look no further",
  "dive into",
  "delve",
  "embark",
  "journey",
  "seamless",
  "revolutionize",
  "next level",
  "take it to the next level",
  "whether you're",
  "it's not just",
  "say goodbye to",
  "we've got you covered",
  "transform your",
  "empower",
  "curated",
  "Did you know?",
  "Ready to",
];

export interface PostBrief {
  format: PostFormat;
  hook: HookStyle;
  pillar?: string;
  entryPoint?: string;
  moment?: string;
  carousel: boolean;
}

/** Position in history (0 = newest) of the first post where `get` matches, or -1. */
function lastUsed(history: ContentHistory, get: (p: ContentHistory["posts"][number]) => string | undefined, value: string): number {
  return history.posts.findIndex((p) => get(p) === value);
}

/** Lower is better: never-used scores 0, used-in-the-last-post scores highest. */
function recencyScore(index: number, window: number): number {
  return index < 0 ? 0 : Math.max(window - index, 1);
}

function pickLeastRecent<T>(options: T[], score: (o: T) => number, rand: () => number): T | undefined {
  if (!options.length) return undefined;
  return options
    .map((o) => ({ o, s: score(o) + rand() * 0.5 }))
    .sort((a, b) => a.s - b.s)[0].o;
}

/**
 * Chooses the post's format, hook, pillar, entry point and moment from what was posted recently.
 * `rand` can be injected for tests.
 */
export function pickBrief(
  model: BrandModel | undefined,
  history: ContentHistory,
  template: TemplateCategory | undefined,
  opts: { allowCarousel?: boolean; rand?: () => number } = {}
): PostBrief {
  const rand = opts.rand ?? Math.random;
  const window = Math.max(history.posts.length, 6);
  const fitting = template ? FORMATS.filter((f) => f.templates.includes(template)) : FORMATS;
  const pool = fitting.length ? fitting : FORMATS;

  const format = pickLeastRecent(
    pool,
    (f) => recencyScore(lastUsed(history, (p) => p.format, f.id), window) * 2 + (history.dislikes.formats[f.id] ?? 0) * 3,
    rand
  )!;

  // Never the same hook as either of the last two posts.
  const recentHooks = history.posts.slice(0, 2).map((p) => p.hook);
  const hookPool = HOOKS.filter((h) => !recentHooks.includes(h.id));
  const hook = pickLeastRecent(hookPool.length ? hookPool : HOOKS, (h) => recencyScore(lastUsed(history, (p) => p.hook, h.id), window), rand)!;

  const pillars = model?.content.pillars ?? [];
  const pillar = pickLeastRecent(pillars, (x) => recencyScore(lastUsed(history, (p) => p.pillar, x), window), rand);

  // Entry points and moments aren't stored per post; rotate by post count.
  const n = history.posts.length;
  const ceps = model?.content.categoryEntryPoints ?? [];
  const entryPoint = ceps.length ? ceps[(n + Math.floor(rand() * 2)) % ceps.length] : undefined;
  const moments = model?.strategy.audience.moments ?? [];
  const moment = moments.length ? MOMENT_LABELS[moments[n % moments.length]] : undefined;

  const recentCarousel = history.posts.slice(0, 2).some((p) => p.layout === "carousel-cover");
  const carousel = !!(opts.allowCarousel && format.carousel && !recentCarousel);

  return { format, hook, pillar, entryPoint, moment, carousel };
}

/** The brief as fixed instructions for the model. */
export function briefBlock(b: PostBrief): string {
  return [
    `POST BRIEF (follow exactly, these are decisions, not suggestions):`,
    `- FORMAT: ${b.format.label}. ${b.format.instruction}`,
    `- HOOK: ${b.hook.instruction}`,
    b.pillar && `- CONTENT PILLAR: ${b.pillar}`,
    b.entryPoint && `- SITUATION TO TIE IT TO: ${b.entryPoint}`,
    b.moment && `- MOMENT: ${b.moment}`,
    `- VISUAL TEXT: ${b.format.visualText}`,
    b.carousel
      ? `- CAROUSEL: write "slides" with 4-6 slides. Slide 1 is the cover (the headline). Each other slide has a headline (max 8 words) and an optional body (max 20 words).`
      : `- Single image post. "slides" must be an empty array.`,
  ]
    .filter(Boolean)
    .join("\n");
}

// ── Layout choice ──────────────────────────────────────────────────────────
const PHOTO_LAYOUTS: LayoutId[] = ["photo-band", "full-bleed", "split", "framed"];

export function layoutNeedsPhoto(id: LayoutId): boolean {
  return PHOTO_LAYOUTS.includes(id) || id === "carousel-cover";
}

/**
 * Picks the visual layout: matches the format, only from the brand's kit, never the
 * same as either of the last two posts, fewer thumbs-down first.
 */
export function chooseLayout(
  kit: LayoutKit,
  formatId: string | undefined,
  history: ContentHistory,
  opts: { carousel?: boolean; rand?: () => number } = {}
): LayoutId {
  if (opts.carousel) return "carousel-cover";
  const rand = opts.rand ?? Math.random;
  const allowed: LayoutId[] = kit.layouts.filter((l) => l !== "carousel-slide" && l !== "carousel-cover");
  const format = FORMATS.find((f) => f.id === formatId);
  const recent = history.posts.slice(0, 2).map((p) => p.layout);
  const preferred = (format?.layouts ?? []).filter((l) => allowed.includes(l));
  const candidates = (preferred.length ? preferred : allowed).filter((l) => !recent.includes(l));
  const pool = candidates.length ? candidates : allowed.filter((l) => !recent.includes(l));
  const final = pool.length ? pool : allowed.length ? allowed : (["photo-band"] as LayoutId[]);
  return final
    .map((l, i) => ({ l, s: i + (history.dislikes.layouts[l] ?? 0) * 3 + rand() * 0.8 }))
    .sort((a, b) => a.s - b.s)[0].l;
}
