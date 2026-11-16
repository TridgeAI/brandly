import "server-only";
import { ImageResponse } from "next/og";
import type { BrandModel, LayoutId } from "@/lib/brand/model";
import type { GeneratedPost } from "@/lib/types";
import { layoutNeedsPhoto } from "@/lib/content/brief";
import { brandFonts } from "./fonts";
import { layoutKitOf } from "./kit";
import { LAYOUTS, type LayoutProps } from "./layouts";

export type RenderSize = "1080x1350" | "1080x1080";

export interface RenderInput {
  model: BrandModel;
  post: Pick<GeneratedPost, "headline" | "subline" | "cta" | "items" | "stat" | "slides" | "caption">;
  layout: LayoutId;
  size: RenderSize;
  /** Data URIs, already resolved. */
  logo?: string;
  logoTone?: "light" | "dark";
  photo?: string;
}

/** Renders one PNG per slide (one for a single-image post). */
export async function renderPost(input: RenderInput): Promise<Buffer[]> {
  const { model, post, size } = input;
  const [width, height] = size.split("x").map(Number);
  const kit = layoutKitOf(model)!;
  const t = model.expression.tokens;
  const fonts = await brandFonts(t.font.heading.$value, t.font.body.$value);
  const base: Omit<LayoutProps, "headline"> = {
    kit,
    colors: { primary: t.color.primary.$value, secondary: t.color.secondary.$value, accent: t.color.accent.$value, neutral: t.color.neutral.$value },
    fonts: { heading: fonts.heading, body: fonts.body },
    brandName: model.name,
    logo: input.logo,
    logoTone: input.logoTone,
    width,
    height,
  };
  const headline = (post.headline || post.caption?.split(/[.!?\n]/)[0] || model.name).slice(0, 140);

  const frames: LayoutProps[] = [];
  if (input.layout === "carousel-cover" && post.slides?.length) {
    const slides = post.slides;
    const total = slides.length;
    frames.push({ ...base, headline: slides[0].headline || headline, subline: slides[0].body || post.subline, photo: input.photo, slide: { index: 1, total } });
    slides.slice(1).forEach((s, i) => frames.push({ ...base, headline: s.headline, subline: s.body, cta: post.cta, slide: { index: i + 2, total } }));
  } else {
    frames.push({ ...base, headline, subline: post.subline, cta: post.cta, items: post.items, stat: post.stat, photo: layoutNeedsPhoto(input.layout) ? input.photo : undefined });
  }

  return Promise.all(
    frames.map(async (props, i) => {
      const Layout = LAYOUTS[i === 0 ? input.layout : "carousel-slide"];
      const res = new ImageResponse(<Layout {...props} />, {
        width,
        height,
        fonts: fonts.fonts.map((f) => ({ name: f.name, data: f.data, weight: f.weight, style: f.style })),
      });
      return Buffer.from(await res.arrayBuffer());
    })
  );
}
