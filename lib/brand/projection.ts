import type { BrandDNA } from "../types";
import { emptyModel, type BrandModel } from "./model";
import { describeAudience, MOMENT_LABELS, MOTIVATION_LABELS } from "./audience";
import { mergePatch } from "./merge";
import { BUSINESS_MODELS, INDUSTRIES, PRIMARY_GOALS } from "./taxonomy";

/** Projects the Brand Model onto the legacy flat BrandDNA so existing pages and routes keep working. */
export function toBrandDNA(m: BrandModel): BrandDNA {
  const c = m.expression.tokens.color;
  const audience = describeAudience(m.strategy.audience);
  return {
    brandName: m.name,
    colors: {
      primary: c.primary.$value,
      secondary: c.secondary.$value,
      accent: c.accent.$value,
      neutral: c.neutral.$value,
    },
    typography_feel:
      m.expression.typographyFeel ||
      `${m.expression.tokens.font.heading.$value} headings, ${m.expression.tokens.font.body.$value} body`,
    visual_style: m.expression.visualStyle,
    vibe: m.content.vibe,
    products_services: m.content.productsServices.length ? m.content.productsServices : [m.strategy.offering].filter(Boolean),
    target_audience: [audience, m.strategy.audience.psychographic].filter(Boolean).join(". "),
    communication_tone: m.voice.description,
    content_themes: m.content.pillars,
    hashtag_clusters: m.content.hashtagClusters,
    do: m.content.do,
    dont: m.content.dont,
    one_liner: m.identity.oneLiner,
  };
}

/** Wraps a legacy BrandDNA into a Brand Model (used for migrating saved brands). */
export function fromBrandDNA(dna: BrandDNA, id: string, mode: BrandModel["mode"] = "analyse"): BrandModel {
  const base = emptyModel(dna.brandName, mode, id);
  const { model } = mergePatch(
    base,
    {
      strategy: { offering: dna.products_services?.[0] ?? "", audience: { psychographic: dna.target_audience } },
      identity: { oneLiner: dna.one_liner },
      expression: {
        tokens: {
          color: {
            primary: { $type: "color", $value: dna.colors.primary },
            secondary: { $type: "color", $value: dna.colors.secondary },
            accent: { $type: "color", $value: dna.colors.accent },
            neutral: { $type: "color", $value: dna.colors.neutral },
          },
        },
        typographyFeel: dna.typography_feel,
        visualStyle: dna.visual_style,
      },
      voice: { description: dna.communication_tone },
      content: {
        pillars: dna.content_themes,
        hashtagClusters: dna.hashtag_clusters,
        do: dna.do,
        dont: dna.dont,
        vibe: dna.vibe,
        productsServices: dna.products_services,
      },
    },
    { source: "inferred", confidence: 0.7 }
  );
  return model;
}

const toneWord = (v: number, neg: string, pos: string) =>
  Math.abs(v) < 0.2 ? `balanced between ${neg} and ${pos}` : v < 0 ? (v < -0.6 ? `very ${neg}` : neg) : v > 0.6 ? `very ${pos}` : pos;

/**
 * The ONLY place the Brand Model is turned into prompt text. Kept stable so it
 * can be prompt-cached as a prefix across every generation call.
 */
export function toPromptContext(m: BrandModel): string {
  const a = m.strategy.audience;
  const t = m.voice.tone;
  const c = m.expression.tokens.color;
  const lines = [
    `BRAND: ${m.name}`,
    m.identity.oneLiner && `ONE-LINER: ${m.identity.oneLiner}`,
    m.strategy.offering && `SELLS: ${m.strategy.offering}${m.strategy.category ? ` (category: ${m.strategy.category})` : ""}`,
    (m.strategy.industry || m.strategy.businessModel || m.strategy.primaryGoal) &&
      `BUSINESS: ${[
        m.strategy.industry && INDUSTRIES.find((i) => i.key === m.strategy.industry)?.label,
        m.strategy.businessModel && BUSINESS_MODELS.find((i) => i.key === m.strategy.businessModel)?.label,
        m.strategy.primaryGoal && `goal: ${PRIMARY_GOALS.find((i) => i.key === m.strategy.primaryGoal)?.label}`,
      ]
        .filter(Boolean)
        .join("; ")}`,
    m.strategy.promise && `PROMISE: ${m.strategy.promise}`,
    m.strategy.differentiators.length && `DIFFERENT BECAUSE: ${m.strategy.differentiators.join("; ")}`,
    `AUDIENCE: ${describeAudience(a) || "not specified"}${a.psychographic ? `. ${a.psychographic}` : ""}`,
    a.languages.length && `POST LANGUAGES: ${a.languages.join(", ")}`,
    a.motivations.length && `WHY THEY BUY: ${a.motivations.map((x) => MOTIVATION_LABELS[x]).join(", ")}`,
    a.moments.length && `WHEN THEY THINK OF US: ${a.moments.map((x) => MOMENT_LABELS[x]).join(", ")}`,
    `VOICE: ${[
      toneWord(t.funny_serious, "funny", "serious"),
      toneWord(t.formal_casual, "formal", "casual"),
      toneWord(t.respectful_irreverent, "respectful", "irreverent"),
      toneWord(t.enthusiastic_matter, "enthusiastic", "matter-of-fact"),
    ].join("; ")}.${m.voice.description ? ` ${m.voice.description}` : ""}`,
    m.voice.vocabulary.use.length && `WORDS WE USE: ${m.voice.vocabulary.use.join(", ")}`,
    m.voice.vocabulary.avoid.length && `WORDS WE AVOID: ${m.voice.vocabulary.avoid.join(", ")}`,
    m.voice.sampleLines.length && `EXAMPLE LINES: ${m.voice.sampleLines.map((s) => `"${s}"`).join(" ")}`,
    m.content.vibe.length && `VIBE: ${m.content.vibe.join(", ")}`,
    `VISUALS: palette ${c.primary.$value} (primary), ${c.secondary.$value}, ${c.accent.$value} (accent), ${c.neutral.$value} (background); fonts ${m.expression.tokens.font.heading.$value} / ${m.expression.tokens.font.body.$value}.${m.expression.visualStyle ? ` ${m.expression.visualStyle}` : ""}${m.expression.imageryStyle ? ` Imagery: ${m.expression.imageryStyle}` : ""}`,
    m.content.pillars.length && `CONTENT PILLARS: ${m.content.pillars.join("; ")}`,
    m.content.do.length && `DO: ${m.content.do.join("; ")}`,
    m.content.dont.length && `DON'T: ${m.content.dont.join("; ")}`,
    m.compliance.minorsInAudience &&
      `COMPLIANCE: audience includes under-18s. Never mention ${m.compliance.restrictedTopics.join(", ")}.`,
    `RULE: audience gender guides who appears in images and examples only. Never use gender stereotypes.`,
  ];
  return lines.filter(Boolean).join("\n");
}
