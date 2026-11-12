import { generateStructured } from "../../llm";
import { dedupeColors, hexToRgb } from "../color";
import { complianceFor } from "../audience";
import { ExtractSchema } from "../schemas";
import { AGE_GROUPS, MOMENTS, MOTIVATIONS, type ModelPatch } from "../model";
import type { IngestOutput } from "./ingest";
import type { StageDefinition, StagePatch } from "./types";

const SYSTEM = `You are a senior brand strategist. You turn evidence about a real business into a precise brand profile.
Be concrete and specific to this business. Never invent facts that contradict the evidence.
When evidence is thin, make a sensible, modest guess and keep it short.`;

const near = (a: string, b: string) => {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2) < 30;
};

function buildPrompt(name: string, ev: IngestOutput, detectedColors: string[]): string {
  const site = ev.website;
  return `Brand name: ${name}
${site ? `Website: ${site.url}
Title: ${site.title}
Meta description: ${site.description}
Headlines: ${site.headings.join(" | ")}
Detected fonts (from CSS): ${site.fonts.join(", ") || "none"}
Page copy (excerpt): ${site.copySample.slice(0, 3500)}` : "Website: not provided"}
${ev.visual ? `Visual analysis of catalogue/social images: ${JSON.stringify(ev.visual)}` : ""}
${ev.igHandle ? `Instagram handle: @${ev.igHandle} (posts not read)` : ""}
Detected brand colours, most used first: ${detectedColors.join(", ") || "none"}

Return JSON with exactly these keys:
{
  "oneLiner": "what the brand is, in under 15 words",
  "offering": "what they sell, plain words",
  "category": "market category",
  "problem": "customer problem they solve",
  "promise": "the core promise",
  "differentiators": ["up to 3"],
  "prism": {"physique": "", "personality": "", "culture": "", "relationship": "", "reflection": "", "selfImage": ""},
  "archetype": "one Jungian brand archetype name",
  "personality": {"sincerity": 0-1, "excitement": 0-1, "competence": 0-1, "sophistication": 0-1, "ruggedness": 0-1},
  "colors": {"primary": "#RRGGBB", "secondary": "#RRGGBB", "accent": "#RRGGBB", "neutral": "#RRGGBB"},
  "headingFont": "", "bodyFont": "", "typographyFeel": "", "visualStyle": "", "imageryStyle": "",
  "tone": {"funny_serious": -1..1, "formal_casual": -1..1, "respectful_irreverent": -1..1, "enthusiastic_matter": -1..1},
  "voiceDescription": "2 sentences on how they write",
  "vocabularyUse": ["words/phrases they use"], "vocabularyAvoid": ["words to avoid"],
  "sampleLines": ["3 short lines in their voice"],
  "audience": {
    "gender": "women" | "men" | "all",
    "ageGroups": subset of ${JSON.stringify(AGE_GROUPS)},
    "affluence": "value" | "mid" | "premium" | "luxury",
    "countries": [], "cityTiers": subset of ["metro","tier2","tier3","rural"],
    "languages": ["languages the copy uses or customers likely prefer"],
    "motivations": up to 2 of ${JSON.stringify(MOTIVATIONS)},
    "moments": subset of ${JSON.stringify(MOMENTS)},
    "psychographic": "one sentence on lifestyle and values"
  },
  "audienceConfidence": 0-1,
  "vibe": ["4 words"], "productsServices": ["up to 5"],
  "pillars": ["4 content pillars"], "hashtagClusters": ["6 hashtags with #"],
  "do": ["3 rules"], "dont": ["3 rules"]
}
Colour rules: if colours were detected, choose primary/secondary/accent ONLY from the detected list. neutral is a light background colour.
Font rules: use detected fonts when available.`;
}

export const extractStage: StageDefinition<IngestOutput> = {
  id: "extract",
  label: "Building your brand profile",
  reads: [],
  writes: ["strategy", "identity", "personality", "expression", "voice", "content"],
  async run(model, ev, { report }) {
    const detectedColors = dedupeColors([...(ev.website?.colors ?? []), ...(ev.visual?.colors ?? [])]).slice(0, 8);
    if (!ev.website && !ev.visual && !ev.igHandle) {
      throw new Error("Nothing to analyse yet. Add a website, Instagram screenshots or a PDF.");
    }

    report({ id: "synth", label: "Putting your brand profile together", status: "info" });
    const r = await generateStructured(ExtractSchema, SYSTEM, buildPrompt(model.name, ev, detectedColors), {
      task: "creative",
      maxTokens: 2500,
    });

    const patches: StagePatch[] = [];
    const fromEvidence = (hex?: string) => !!hex && detectedColors.some((d) => near(d, hex));

    // Colours: high confidence only when they match what we actually saw.
    const colorConf: Record<string, number> = {};
    const color: Record<string, { $type: "color"; $value: string }> = {};
    (["primary", "secondary", "accent", "neutral"] as const).forEach((role) => {
      const hex = r.colors[role];
      if (!hex) return;
      color[role] = { $type: "color", $value: hex };
      colorConf[`expression.tokens.color.${role}`] = role === "neutral" ? 0.75 : fromEvidence(hex) ? 0.95 : 0.4;
    });
    patches.push({
      patch: { expression: { tokens: { color } } } as ModelPatch,
      options: {
        source: "extracted",
        confidence: 0.4,
        confidenceByPath: colorConf,
        evidenceByPath: Object.fromEntries(Object.keys(colorConf).map((p) => [p, detectedColors.length ? "website / image colours" : "AI guess"])),
      },
    });

    // Fonts
    const detectedFonts = ev.website?.fonts ?? [];
    const fontConf = (f: string) => (detectedFonts.some((d) => d.toLowerCase() === f.toLowerCase()) ? 0.9 : 0.45);
    patches.push({
      patch: {
        expression: {
          tokens: {
            font: {
              heading: r.headingFont ? { $type: "fontFamily", $value: r.headingFont } : undefined,
              body: r.bodyFont ? { $type: "fontFamily", $value: r.bodyFont } : undefined,
            },
          },
        },
      },
      options: {
        source: "extracted",
        confidence: 0.45,
        confidenceByPath: {
          "expression.tokens.font.heading": fontConf(r.headingFont),
          "expression.tokens.font.body": fontConf(r.bodyFont),
        },
      },
    });

    if (ev.website?.logoUrl) {
      patches.push({ patch: { expression: { logoUrl: ev.website.logoUrl } }, options: { source: "extracted", confidence: 0.85 } });
    }

    // Audience is always a guess from public sources → always ask the user to confirm.
    const a = r.audience;
    patches.push({
      patch: {
        strategy: {
          audience: {
            gender: a.gender,
            ageGroups: a.ageGroups,
            affluence: a.affluence,
            markets: { countries: a.countries, cityTiers: a.cityTiers },
            languages: a.languages,
            motivations: a.motivations,
            moments: a.moments,
            psychographic: a.psychographic,
          },
        },
      },
      options: { source: "inferred", confidence: Math.min(0.5, r.audienceConfidence * 0.6) },
    });

    // Everything else: a reasonable inference from the evidence.
    patches.push({
      patch: {
        strategy: {
          category: r.category,
          offering: r.offering,
          problem: r.problem,
          promise: r.promise,
          differentiators: r.differentiators,
        },
        identity: { prism: r.prism, archetype: r.archetype, oneLiner: r.oneLiner },
        expression: { typographyFeel: r.typographyFeel, visualStyle: r.visualStyle, imageryStyle: r.imageryStyle },
        voice: {
          tone: r.tone,
          description: r.voiceDescription,
          vocabulary: { use: r.vocabularyUse, avoid: r.vocabularyAvoid },
          sampleLines: r.sampleLines,
        },
        content: {
          vibe: r.vibe,
          productsServices: r.productsServices,
          pillars: r.pillars,
          hashtagClusters: r.hashtagClusters,
          do: r.do,
          dont: r.dont,
        },
      },
      options: { source: "inferred", confidence: ev.website ? 0.7 : 0.55 },
    });
    patches.push({ patch: { personality: r.personality }, options: { source: "inferred", confidence: 0.6 } });

    report({
      id: "synth",
      label: "Brand profile ready",
      detail: r.oneLiner || undefined,
      status: "done",
    });

    return {
      patches,
      output: { compliance: complianceFor({ ageGroups: a.ageGroups }) },
    };
  },
};
