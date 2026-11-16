/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text */
// Shared pieces for Satori layouts. Satori only supports flexbox: every element
// with more than one child needs display: flex.
import type { CSSProperties, ReactNode } from "react";
import type { LayoutId, LayoutKit } from "@/lib/brand/model";
import { contrastRatio, readableOn } from "@/lib/brand/color";

export interface LayoutColors {
  primary: string;
  secondary: string;
  accent: string;
  neutral: string;
}

export interface LayoutProps {
  kit: LayoutKit;
  colors: LayoutColors;
  /** Font family names registered with the renderer. */
  fonts: { heading: string; body: string };
  brandName: string;
  /** Data URI of the logo (PNG/JPEG/SVG), if usable. */
  logo?: string;
  /** Average tone of the logo's visible pixels, to keep it visible on the background. */
  logoTone?: "light" | "dark";
  /** Data URI of the photo, if the layout uses one. */
  photo?: string;
  headline: string;
  subline?: string;
  cta?: string;
  items?: string[];
  stat?: string;
  width: number;
  height: number;
  /** Carousel position, 1-based. */
  slide?: { index: number; total: number };
}

export type Layout = (p: LayoutProps) => ReactNode;
export type LayoutRegistry = Record<LayoutId, Layout>;

export const PAD = 84;

export function applyCase(text: string, c: LayoutKit["headlineCase"]): string {
  if (c === "upper") return text.toUpperCase();
  if (c === "title") return text.replace(/\b([a-z])([a-z']*)/g, (_, a: string, b: string) => a.toUpperCase() + b);
  return text;
}

/** Headline size that keeps long lines inside the frame. */
export function headlineSize(text: string, width: number, max = 104): number {
  const n = text.length * (text === text.toUpperCase() ? 1.18 : 1);
  const base = n <= 18 ? max : n <= 32 ? max * 0.84 : n <= 50 ? max * 0.7 : n <= 72 ? max * 0.58 : max * 0.48;
  return Math.round((base * width) / 1080);
}

/** Background, text and accent colours for text-led layouts. */
export function scheme(p: LayoutProps) {
  const bg = p.colors[p.kit.background];
  const fg = readableOn(bg);
  // Accent must stand out on the background; fall back through the palette.
  const candidates = [p.colors.accent, p.colors.primary, p.colors.secondary, p.colors.neutral].filter((c) => c !== bg);
  const accent = candidates.find((c) => contrastRatio(c, bg) >= 2.2) ?? fg;
  const muted = fg === "#FFFFFF" ? "rgba(255,255,255,0.78)" : "rgba(17,17,17,0.72)";
  return { bg, fg, accent, muted, onAccent: readableOn(accent) };
}

/** Space to keep clear at the top/bottom edge for the corner logo. */
export function logoSpace(p: LayoutProps, edge: "top" | "bottom"): number {
  return p.kit.logoPosition.startsWith(edge) ? 120 : 0;
}

/** Vertical padding that leaves room for the corner logo. */
export function edgePad(p: LayoutProps, base: number = PAD): CSSProperties {
  return { paddingTop: base + logoSpace(p, "top"), paddingBottom: base + logoSpace(p, "bottom") };
}

export function Logo({ p, color, size = 64, style }: { p: LayoutProps; color: string; size?: number; style?: CSSProperties }) {
  if (p.logo) {
    // A light logo on a light background (or dark on dark) gets a contrasting chip.
    const bgIsLight = color !== "#FFFFFF";
    const needsChip = p.logoTone ? (p.logoTone === "light") === bgIsLight : false;
    const img = <img src={p.logo} height={size} style={{ height: size, maxWidth: size * 4, objectFit: "contain" }} />;
    if (!needsChip) return <div style={{ display: "flex", ...style }}>{img}</div>;
    return (
      <div style={{ display: "flex", padding: Math.round(size * 0.18), borderRadius: Math.min(p.kit.radius, size / 3), background: bgIsLight ? "#1A1A1A" : "#FFFFFF", ...style }}>
        {img}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", fontFamily: p.fonts.heading, fontWeight: 700, fontSize: Math.round(size * 0.62), color, letterSpacing: 0.5, ...style }}>
      {p.brandName}
    </div>
  );
}

/** Logo pinned to the kit's corner. */
export function CornerLogo({ p, color, size = 76 }: { p: LayoutProps; color: string; size?: number }) {
  const pos = p.kit.logoPosition;
  const style: CSSProperties = {
    position: "absolute",
    display: "flex",
    ...(pos.startsWith("top") ? { top: PAD * 0.7 } : { bottom: PAD * 0.7 }),
    ...(pos.endsWith("left") ? { left: PAD } : { right: PAD }),
  };
  return (
    <div style={style}>
      <Logo p={p} color={color} size={size} />
    </div>
  );
}

/** The kit's accent shape, drawn behind or beside the headline. */
export function AccentMark({ p, color }: { p: LayoutProps; color: string }) {
  const s = p.kit.accentShape;
  if (s === "none") return null;
  if (s === "bar") return <div style={{ display: "flex", width: 120, height: 14, background: color, borderRadius: Math.min(p.kit.radius, 7), marginBottom: 36 }} />;
  if (s === "underline") return <div style={{ display: "flex", width: 72, height: 4, background: color, marginBottom: 40 }} />;
  if (s === "circle") return <div style={{ display: "flex", width: 56, height: 56, background: color, borderRadius: 28, marginBottom: 36 }} />;
  // corner
  return <div style={{ display: "flex", width: 64, height: 64, borderTop: `10px solid ${color}`, borderLeft: `10px solid ${color}`, marginBottom: 32 }} />;
}

export function Headline({ p, color, size, style }: { p: LayoutProps; color: string; size?: number; style?: CSSProperties }) {
  const text = applyCase(p.headline, p.kit.headlineCase);
  // Capitals are wider: shrink explicit sizes too.
  const fs = size ? Math.round(size * (p.kit.headlineCase === "upper" ? 0.86 : 1)) : headlineSize(text, p.width);
  return (
    <div
      style={{
        display: "flex",
        fontFamily: p.fonts.heading,
        fontWeight: 700,
        fontSize: fs,
        lineHeight: 1.08,
        letterSpacing: p.kit.headlineCase === "upper" ? 1 : -1,
        color,
        ...style,
      }}
    >
      {text}
    </div>
  );
}

export function Subline({ p, color, size = 38, style }: { p: LayoutProps; color: string; size?: number; style?: CSSProperties }) {
  if (!p.subline) return null;
  return <div style={{ display: "flex", fontFamily: p.fonts.body, fontSize: size, lineHeight: 1.35, color, marginTop: 28, ...style }}>{p.subline}</div>;
}

export function Cta({ p, bg, fg }: { p: LayoutProps; bg: string; fg: string }) {
  if (!p.cta) return null;
  const text = p.cta.length > 42 ? p.cta.slice(0, 40).replace(/\s+\S*$/, "") + "…" : p.cta;
  return (
    <div
      style={{
        display: "flex",
        alignSelf: "flex-start",
        padding: "18px 34px",
        background: bg,
        color: fg,
        borderRadius: Math.min(p.kit.radius * 2, 40),
        fontFamily: p.fonts.body,
        fontWeight: 700,
        fontSize: 30,
        marginTop: 44,
      }}
    >
      {text}
    </div>
  );
}

export function Frame({ bg, children, style }: { bg: string; children: ReactNode; style?: CSSProperties }) {
  return <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", background: bg, ...style }}>{children}</div>;
}

export function Photo({ p, style }: { p: LayoutProps; style?: CSSProperties }) {
  if (!p.photo) return <div style={{ display: "flex", background: p.colors.secondary, ...style }} />;
  return <img src={p.photo} style={{ objectFit: "cover", ...style }} />;
}
