import { checkPalette, hexToRgb } from "../color";
import { complianceFor } from "../audience";
import type { StageDefinition } from "./types";

const distance = (a: string, b: string) => {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
};

/** Deterministic checks. No AI, no cost. */
export const validateStage: StageDefinition<Record<string, never>> = {
  id: "validate",
  label: "Checking colours and rules",
  reads: ["expression", "strategy"],
  writes: [],
  async run(model, _input, { report }) {
    const c = model.expression.tokens.color;
    const palette = {
      primary: c.primary.$value,
      secondary: c.secondary.$value,
      accent: c.accent.$value,
      neutral: c.neutral.$value,
    };
    const check = checkPalette(palette);
    const issues = [...check.issues];

    // Consistency across sources: do website and catalogue/IG colours agree?
    const sets = model.evidence.filter((e) => e.colors?.length).map((e) => ({ source: e.source, colors: e.colors! }));
    if (sets.length >= 2) {
      const [a, b] = sets;
      const shared = a.colors.filter((x) => b.colors.some((y) => distance(x, y) < 45)).length;
      if (shared === 0) issues.push(`Your ${a.source} and ${b.source} use different colours. Pick one set so posts look consistent.`);
    }

    const compliance = complianceFor(model.strategy.audience);
    if (compliance.minorsInAudience) issues.push("Your audience includes under-18s, so posts will avoid alcohol, gambling, dieting and dating topics.");

    report({
      id: "validate",
      label: check.ok ? "Colours pass the readability check" : "Some colours need a look",
      detail: `Text on primary colour: ${check.textOnPrimary.toFixed(1)}:1 contrast`,
      status: check.ok ? "done" : "warn",
    });

    return { patches: [], issues, output: { compliance, palette: check } };
  },
};
