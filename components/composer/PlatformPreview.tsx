"use client";
import { useState } from "react";
import type { GeneratedPost, Platform, BrandDNA } from "@/lib/types";
import { PLATFORM_ICONS, PLATFORM_LABELS } from "@/lib/templates";
import clsx from "clsx";

interface Props {
  post: GeneratedPost;
  platforms: Platform[];
  brandDNA?: BrandDNA | null;
  igHandle?: string;
  /** Branded image(s) from /api/render-post; several = carousel. */
  images?: string[];
  imageLoading?: boolean;
}

export default function PlatformPreview({ post, platforms, brandDNA, igHandle, images = [], imageLoading }: Props) {
  const [active, setActive] = useState<Platform>(platforms[0]);
  const [slide, setSlide] = useState(0);
  const imageUrl = images[Math.min(slide, images.length - 1)] ?? null;

  const getCaption = () => {
    return post.platformVariants?.[active] ?? post.caption;
  };

  const charLimit: Record<Platform, number> = {
    instagram: 2200,
    facebook: 63206,
    linkedin: 3000,
    twitter: 280,
  };

  const caption = getCaption();
  const limit = charLimit[active];
  const overLimit = caption.length > limit;

  return (
    <div className="flex flex-col h-full">
      {/* Platform tabs */}
      <div className="flex gap-1 p-1 bg-surface rounded-xl mb-4">
        {platforms.map((p) => (
          <button
            key={p}
            onClick={() => setActive(p)}
            className={clsx(
              "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all",
              active === p
                ? "bg-card text-text border border-border"
                : "text-text-muted hover:text-text"
            )}
          >
            <span>{PLATFORM_ICONS[p]}</span>
            <span className="hidden sm:inline">{PLATFORM_LABELS[p]}</span>
          </button>
        ))}
      </div>

      {/* Preview card */}
      <div className="flex-1 bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
        {/* Profile header */}
        <div className="p-4 border-b border-border flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full shrink-0"
            style={{
              background: brandDNA
                ? `linear-gradient(135deg, ${brandDNA.colors.primary}, ${brandDNA.colors.secondary})`
                : "rgb(var(--text) / 0.15)",
            }}
          />
          <div>
            <p className="text-sm font-semibold">
              {active === "twitter"
                ? `@${igHandle || "yourbrand"}`
                : igHandle || "Your Brand"}
            </p>
            <p className="text-xs text-text-muted">
              {PLATFORM_ICONS[active]} {PLATFORM_LABELS[active]} · {post.postType}
            </p>
          </div>
        </div>

        {/* Branded image (or carousel) */}
        {imageUrl && (
          <div className={clsx("relative border-b border-border transition-opacity", imageLoading && "opacity-60")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={post.headline || post.imagePrompt} className="w-full object-cover" />
            {images.length > 1 && (
              <>
                <span className="absolute top-3 right-3 text-[11px] px-2 py-0.5 rounded-full bg-black/60 text-white">
                  {Math.min(slide, images.length - 1) + 1}/{images.length}
                </span>
                <button
                  aria-label="Previous slide"
                  disabled={slide === 0}
                  onClick={() => setSlide((i) => Math.max(0, i - 1))}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white disabled:opacity-0"
                >
                  ‹
                </button>
                <button
                  aria-label="Next slide"
                  disabled={slide >= images.length - 1}
                  onClick={() => setSlide((i) => Math.min(images.length - 1, i + 1))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white disabled:opacity-0"
                >
                  ›
                </button>
              </>
            )}
          </div>
        )}

        {/* Image placeholder */}
        {!imageUrl && (active === "instagram" || active === "facebook") && (
          <div
            className="aspect-[4/5] flex flex-col items-center justify-center p-6 text-center border-b border-border"
            style={{
              background: brandDNA
                ? `linear-gradient(135deg, ${brandDNA.colors.primary}18, ${brandDNA.colors.secondary}18)`
                : "rgb(var(--text) / 0.04)",
            }}
          >
            <p className="text-xs font-medium text-text mb-2">{imageLoading ? "Laying out your post…" : "Image idea"}</p>
            <p className="text-xs text-text-muted leading-relaxed max-w-xs">{post.imagePrompt}</p>
          </div>
        )}

        {/* LinkedIn header image */}
        {!imageUrl && active === "linkedin" && (
          <div
            className="h-32 flex items-center justify-center border-b border-border"
            style={{
              background: brandDNA
                ? `linear-gradient(135deg, ${brandDNA.colors.primary}, ${brandDNA.colors.accent})`
                : "rgb(var(--text) / 0.15)",
            }}
          >
            <p className="text-white/70 text-xs font-medium">Banner image area</p>
          </div>
        )}

        {/* Content */}
        <div className="p-4 flex-1 overflow-y-auto">
          <p className={clsx("text-sm leading-relaxed whitespace-pre-line mb-3", overLimit && "text-error")}>
            {caption}
          </p>

          {/* Hashtags — shown for IG and Twitter */}
          {(active === "instagram" || active === "twitter") && (
            <div className="flex flex-wrap gap-1 mb-3">
              {post.hashtags.slice(0, active === "twitter" ? 2 : 15).map((h) => (
                <span key={h} className="text-xs text-accent-light">{h}</span>
              ))}
            </div>
          )}

          {/* LinkedIn hashtags */}
          {active === "linkedin" && (
            <div className="flex flex-wrap gap-1 mb-3">
              {post.hashtags.slice(0, 3).map((h) => (
                <span key={h} className="text-xs text-accent-light">{h}</span>
              ))}
            </div>
          )}

          {/* CTA */}
          {post.cta && (
            <div className="p-3 bg-accent/10 rounded-lg text-xs text-accent-light font-medium mt-2">
              {post.cta}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border flex items-center justify-between">
          <p className={clsx("text-xs", overLimit ? "text-error" : "text-text-muted")}>
            {caption.length} / {limit.toLocaleString()} chars
          </p>
          <p className="text-xs text-text-muted">⏰ {post.bestTimeToPost}</p>
        </div>
      </div>
    </div>
  );
}
