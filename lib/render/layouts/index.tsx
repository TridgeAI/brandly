import { CarouselCover, CarouselSlide } from "./carousel";
import { FullBleed, Framed, PhotoBand, Split } from "./photo";
import type { LayoutRegistry } from "./shared";
import { BigNumber, Checklist, MythFact, Quote } from "./text";

export type { LayoutProps, LayoutColors } from "./shared";

export const LAYOUTS: LayoutRegistry = {
  "photo-band": PhotoBand,
  "full-bleed": FullBleed,
  "big-number": BigNumber,
  quote: Quote,
  split: Split,
  framed: Framed,
  checklist: Checklist,
  "myth-fact": MythFact,
  "carousel-cover": CarouselCover,
  "carousel-slide": CarouselSlide,
};
