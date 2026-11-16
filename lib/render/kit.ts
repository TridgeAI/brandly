// Brand Layout Kit helpers (pure: safe on client and server).
import { LAYOUT_IDS, type BrandModel, type ColorRole, type LayoutId, type LayoutKit } from "@/lib/brand/model";
import { contrastRatio, hexToHsl } from "@/lib/brand/color";

export const LAYOUT_LABELS: Record<LayoutId, string> = {
  "photo-band": "Photo + headline band",
  "full-bleed": "Full photo with overlay",
  "big-number": "Big number",
  quote: "Quote card",
  split: "Split",
  framed: "Framed product",
  checklist: "Checklist",
  "myth-fact": "Myth / fact",
  "carousel-cover": "Carousel cover",
  "carousel-slide": "Carousel slide",
};

/** Layouts a user can turn on/off (carousel slides follow the cover). */
export const SELECTABLE_LAYOUTS = LAYOUT_IDS.filter((l) => l !== "carousel-slide");

/**
 * A sensible kit derived from personality and palette, used until the
 * layout-kit stage has run (and as its fallback).
 */
export function defaultLayoutKit(m: BrandModel): LayoutKit {
  const p = m.personality;
  const c = m.expression.tokens.color;
  const sophisticated = p.sophistication >= 0.6;
  const rugged = p.ruggedness >= 0.55;
  const exciting = p.excitement >= 0.6;
  // A dark, saturated primary makes a strong background; a pale one does not.
  const primaryL = hexToHsl(c.primary.$value).l;
  const background: ColorRole = primaryL < 0.6 && contrastRatio(c.primary.$value, "#FFFFFF") >= 3 ? "primary" : "neutral";
  const layouts: LayoutId[] = sophisticated
    ? ["framed", "quote", "full-bleed", "split", "big-number", "carousel-cover"]
    : exciting
    ? ["photo-band", "big-number", "checklist", "myth-fact", "split", "carousel-cover", "quote"]
    : ["photo-band", "split", "quote", "checklist", "big-number", "carousel-cover"];
  return {
    layouts,
    radius: sophisticated || rugged ? 0 : exciting ? 28 : 16,
    photoTreatment: sophisticated ? "framed" : rugged ? "duotone" : "full",
    headlineCase: rugged || exciting ? "upper" : "sentence",
    accentShape: sophisticated ? "underline" : exciting ? "circle" : rugged ? "corner" : "bar",
    logoPosition: sophisticated ? "top-left" : "bottom-left",
    background,
  };
}

export function layoutKitOf(m?: BrandModel): LayoutKit | undefined {
  if (!m) return undefined;
  const kit = m.expression.layoutKit;
  if (!kit?.layouts?.length) return defaultLayoutKit(m);
  return { ...defaultLayoutKit(m), ...kit, layouts: kit.layouts.filter((l) => (LAYOUT_IDS as readonly string[]).includes(l)) };
}
