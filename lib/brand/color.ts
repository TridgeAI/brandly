import type { Personality, PersonalityKey } from "./model";

// ── Conversions ────────────────────────────────────────────────────────────
export interface HSL { h: number; s: number; l: number } // h 0–360, s/l 0–1

export function normalizeHex(input: string): string | null {
  const m = input.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let hex = m[1].toLowerCase();
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  return `#${hex.toUpperCase()}`;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = (normalizeHex(hex) ?? "#000000").slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

export function hexToHsl(hex: string): HSL {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}

export function hslToHex({ h, s, l }: HSL): string {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let rgb: [number, number, number];
  if (hue < 60) rgb = [c, x, 0];
  else if (hue < 120) rgb = [x, c, 0];
  else if (hue < 180) rgb = [0, c, x];
  else if (hue < 240) rgb = [0, x, c];
  else if (hue < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return rgbToHex((rgb[0] + m) * 255, (rgb[1] + m) * 255, (rgb[2] + m) * 255);
}

// ── WCAG contrast ──────────────────────────────────────────────────────────
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export type WcagLevel = "AAA" | "AA" | "AA Large" | "Fail";
export function wcagLevel(ratio: number): WcagLevel {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA Large";
  return "Fail";
}

/** Best readable text colour on a background. */
export function readableOn(bg: string): "#FFFFFF" | "#111111" {
  return contrastRatio(bg, "#FFFFFF") >= contrastRatio(bg, "#111111") ? "#FFFFFF" : "#111111";
}

// ── Palette helpers ────────────────────────────────────────────────────────
const colorDistance = (a: string, b: string) => {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
};

/** Dedupe near-identical colours, keeping order (most frequent first). */
export function dedupeColors(colors: string[], minDistance = 28): string[] {
  const out: string[] = [];
  for (const c of colors) {
    const hex = normalizeHex(c);
    if (!hex) continue;
    if (out.every((o) => colorDistance(o, hex) >= minDistance)) out.push(hex);
  }
  return out;
}

export const isNearGray = (hex: string) => hexToHsl(hex).s < 0.12;
export const isNearWhiteOrBlack = (hex: string) => {
  const { l } = hexToHsl(hex);
  return l > 0.95 || l < 0.06;
};

export interface PaletteCheck {
  ok: boolean;
  issues: string[];
  primaryOnNeutral: number;
  textOnPrimary: number;
}

export function checkPalette(p: { primary: string; secondary: string; accent: string; neutral: string }): PaletteCheck {
  const issues: string[] = [];
  const primaryOnNeutral = contrastRatio(p.primary, p.neutral);
  const textOnPrimary = contrastRatio(p.primary, readableOn(p.primary));
  if (primaryOnNeutral < 3) issues.push("Primary colour is hard to see on the background colour.");
  if (textOnPrimary < 4.5) issues.push("Text on the primary colour may be hard to read.");
  if (colorDistance(p.primary, p.accent) < 40) issues.push("Primary and accent colours look almost the same.");
  return { ok: issues.length === 0, issues, primaryOnNeutral, textOnPrimary };
}

// ── Personality → palette (Labrecque & Milne, 2012) ────────────────────────
// Hue, saturation and value each signal brand personality:
//   excitement → red/orange, high saturation
//   competence → blue, medium saturation
//   sophistication → black/purple, low saturation, low value
//   ruggedness → brown/earthy green, low value
//   sincerity → soft yellow/pink, high value, lower saturation
const HUE_RANGES: Record<PersonalityKey, [number, number]> = {
  excitement: [0, 24],
  competence: [205, 228],
  sophistication: [262, 290],
  ruggedness: [24, 40],
  sincerity: [36, 52],
};

/** Deterministic pseudo-random in [0,1) from a seed. */
function seeded(seed: number) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rankPersonality(p: Personality): PersonalityKey[] {
  return (Object.keys(p) as PersonalityKey[]).sort((a, b) => p[b] - p[a]);
}

export interface Palette {
  primary: string;
  secondary: string;
  accent: string;
  neutral: string;
}

export function personalityToPalette(p: Personality, seed = 1): Palette {
  const rand = seeded(seed);
  const [first, second] = rankPersonality(p);
  const pick = (k: PersonalityKey) => {
    const [a, b] = HUE_RANGES[k];
    // Ruggedness also maps to earthy green on alternate seeds.
    if (k === "ruggedness" && rand() > 0.55) return 105 + rand() * 40;
    if (k === "sincerity" && rand() > 0.6) return 335 + rand() * 15; // soft pink
    return a + rand() * (b - a);
  };

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const sat = clamp(0.42 + 0.45 * p.excitement - 0.38 * p.sophistication - 0.15 * p.ruggedness + 0.05 * p.competence, 0.08, 0.9);
  const light = clamp(0.46 - 0.24 * p.sophistication - 0.1 * p.ruggedness + 0.08 * p.sincerity, 0.12, 0.6);

  const primaryHsl: HSL = { h: pick(first), s: sat, l: light };
  // Keep the primary dark/strong enough for text on top of it.
  let primary = hslToHex(primaryHsl);
  for (let i = 0; i < 12 && contrastRatio(primary, readableOn(primary)) < 4.5; i++) {
    primaryHsl.l = clamp(primaryHsl.l - 0.03, 0.08, 0.9);
    primary = hslToHex(primaryHsl);
  }

  const secondary = hslToHex({
    h: primaryHsl.h + (rand() > 0.5 ? 18 : -18),
    s: clamp(sat * 0.55, 0.05, 0.6),
    l: clamp(light + 0.22, 0.3, 0.75),
  });

  const accentHue = second === first ? primaryHsl.h + 150 : pick(second);
  const accent = hslToHex({
    h: accentHue,
    s: clamp(0.55 + 0.3 * p.excitement - 0.25 * p.sophistication, 0.2, 0.92),
    l: clamp(0.52 + 0.05 * p.sincerity, 0.4, 0.62),
  });

  const neutral = hslToHex({
    h: primaryHsl.h,
    s: p.sophistication > 0.6 ? 0.04 : 0.18,
    l: p.sophistication > 0.75 ? 0.94 : 0.965,
  });

  return { primary, secondary, accent, neutral };
}

// ── Colour words ───────────────────────────────────────────────────────────
// Image models ignore hex codes, so prompts describe colours in plain words.
const HUE_NAMES: [number, string][] = [
  [15, "red"],
  [40, "orange"],
  [55, "amber"],
  [70, "yellow"],
  [90, "olive"],
  [150, "green"],
  [175, "teal"],
  [200, "cyan"],
  [235, "blue"],
  [260, "indigo"],
  [290, "purple"],
  [330, "magenta"],
  [350, "pink"],
  [361, "red"],
];

/** "#1E3A8A" → "deep navy blue"; "#F5F5F4" → "off-white". */
export function colorToWords(hex: string): string {
  const n = normalizeHex(hex);
  if (!n) return "";
  const { h, s, l } = hexToHsl(n);
  if (s < 0.12) {
    if (l > 0.93) return "off-white";
    if (l > 0.75) return "light grey";
    if (l > 0.45) return "mid grey";
    if (l > 0.15) return "charcoal";
    return "near-black";
  }
  let hue = HUE_NAMES.find(([max]) => h < max)?.[1] ?? "red";
  // Common named shades read better than "dark orange" or "pale red".
  if (hue === "orange" && l < 0.35) hue = "brown";
  if (hue === "blue" && l < 0.3) hue = "navy blue";
  if ((hue === "red" || hue === "pink") && l > 0.8) hue = "blush pink";
  if ((hue === "orange" || hue === "amber" || hue === "yellow") && s < 0.35 && l > 0.7) hue = "beige";
  const tone = l > 0.82 ? "pale" : l > 0.65 ? "light" : l < 0.22 ? "deep" : l < 0.38 ? "dark" : "";
  const sat = s < 0.3 ? "muted" : s > 0.75 && l > 0.35 && l < 0.65 ? "vivid" : "";
  return [sat, tone, hue].filter(Boolean).join(" ");
}

/** De-duplicated colour words for a palette. */
export function paletteToWords(hexes: string[]): string[] {
  return [...new Set(hexes.map(colorToWords).filter(Boolean))];
}
