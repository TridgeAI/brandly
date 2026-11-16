"use client";
import { useEffect } from "react";
import { Heart, MessageCircle, Send, Bookmark } from "lucide-react";
import clsx from "clsx";
import { readableOn, type Palette } from "@/lib/brand/color";
import { loadGoogleFonts } from "@/lib/brand/client";

/**
 * An Instagram-style post rendered entirely in the brand's palette and fonts.
 * Brand colours are scoped to this component and never leak into the app chrome.
 */
export function BrandPostPreview({
  name,
  headline,
  caption,
  palette,
  fonts,
  variant = 0,
  imageUrl,
  className,
}: {
  name: string;
  headline: string;
  caption: string;
  palette: Palette;
  fonts: { heading: string; body: string };
  variant?: number;
  imageUrl?: string;
  className?: string;
}) {
  useEffect(() => loadGoogleFonts([fonts.heading, fonts.body]), [fonts.heading, fonts.body]);
  const onPrimary = readableOn(palette.primary);
  const onNeutral = readableOn(palette.neutral);
  const headingStyle = { fontFamily: `'${fonts.heading}', serif` };
  const bodyStyle = { fontFamily: `'${fonts.body}', sans-serif` };
  const layout = variant % 3;
  // Long one-liners shrink and clamp so they never overflow the square.
  const headlineSize = headline.length > 70 ? 18 : headline.length > 45 ? 22 : headline.length > 28 ? 26 : 30;
  const headlineStyle = { ...headingStyle, fontSize: headlineSize };

  return (
    <div className={clsx("rounded-xl border border-border bg-white text-[#111] overflow-hidden", className)}>
      <div className="flex items-center gap-2 px-3 h-11">
        <span
          className="w-7 h-7 rounded-full grid place-items-center text-[11px] font-bold"
          style={{ background: palette.primary, color: onPrimary, ...headingStyle }}
        >
          {name.slice(0, 1).toUpperCase()}
        </span>
        <span className="text-[13px] font-semibold">{name.toLowerCase().replace(/\s+/g, "")}</span>
      </div>

      <div className="aspect-square relative overflow-hidden" style={{ background: layout === 1 ? palette.primary : palette.neutral }}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : layout === 0 ? (
          <div className="absolute inset-0 p-6 flex flex-col justify-between">
            <span className="w-10 h-1.5 rounded-full" style={{ background: palette.accent }} />
            <p className="leading-[1.08] font-bold line-clamp-5" style={{ ...headlineStyle, color: palette.primary }}>
              {headline}
            </p>
            <div className="flex items-end justify-between">
              <span className="text-xs" style={{ ...bodyStyle, color: onNeutral === "#111111" ? "#444" : "#ddd" }}>
                {name}
              </span>
              <span className="w-16 h-16 rounded-full" style={{ background: palette.secondary, opacity: 0.85 }} />
            </div>
          </div>
        ) : layout === 1 ? (
          <div className="absolute inset-0 p-6 flex flex-col justify-center items-center text-center gap-4">
            <p className="leading-tight font-bold line-clamp-4" style={{ ...headlineStyle, color: onPrimary }}>
              {headline}
            </p>
            <span className="px-4 h-8 rounded-full grid place-items-center text-xs font-semibold" style={{ background: palette.accent, color: readableOn(palette.accent), ...bodyStyle }}>
              Shop now
            </span>
          </div>
        ) : (
          <div className="absolute inset-0 grid grid-rows-[1fr_auto]">
            <div className="grid grid-cols-2">
              <span style={{ background: palette.secondary }} />
              <span style={{ background: palette.accent }} />
            </div>
            <div className="p-5" style={{ background: palette.primary }}>
              <p className="leading-tight font-bold line-clamp-3" style={{ ...headlineStyle, fontSize: Math.min(headlineSize, 24), color: onPrimary }}>
                {headline}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="px-3 pt-2.5 pb-3">
        <div className="flex items-center gap-3.5 mb-2 text-[#111]">
          <Heart size={20} strokeWidth={1.75} />
          <MessageCircle size={20} strokeWidth={1.75} />
          <Send size={20} strokeWidth={1.75} />
          <Bookmark size={20} strokeWidth={1.75} className="ml-auto" />
        </div>
        <p className="text-[13px] leading-snug line-clamp-3" style={bodyStyle}>
          <span className="font-semibold mr-1">{name.toLowerCase().replace(/\s+/g, "")}</span>
          {caption}
        </p>
      </div>
    </div>
  );
}

export function PaletteStrip({ palette, className }: { palette: Palette; className?: string }) {
  const entries: [string, string][] = [
    ["Primary", palette.primary],
    ["Secondary", palette.secondary],
    ["Accent", palette.accent],
    ["Background", palette.neutral],
  ];
  return (
    <div className={clsx("grid grid-cols-4 rounded-lg overflow-hidden border border-border h-10", className)}>
      {entries.map(([label, hex]) => (
        <span key={label} title={`${label} ${hex}`} style={{ background: hex }} />
      ))}
    </div>
  );
}
