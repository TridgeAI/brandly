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
}

export default function PlatformPreview({ post, platforms, brandDNA, igHandle }: Props) {
  const [active, setActive] = useState<Platform>(platforms[0]);

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
                : "linear-gradient(135deg, #7C6EF8, #A89DF9)",
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

        {/* Image placeholder */}
        {(active === "instagram" || active === "facebook") && (
          <div
            className="aspect-square flex flex-col items-center justify-center p-6 text-center border-b border-border"
            style={{
              background: brandDNA
                ? `linear-gradient(135deg, ${brandDNA.colors.primary}18, ${brandDNA.colors.secondary}18)`
                : "linear-gradient(135deg, #7C6EF818, #A89DF918)",
            }}
          >
            <div className="text-4xl mb-3">🎨</div>
            <p className="text-xs font-semibold text-accent-light mb-2">Image Generation Prompt</p>
            <p className="text-xs text-text-muted leading-relaxed max-w-xs">{post.imagePrompt}</p>
          </div>
        )}

        {/* LinkedIn header image */}
        {active === "linkedin" && (
          <div
            className="h-32 flex items-center justify-center border-b border-border"
            style={{
              background: brandDNA
                ? `linear-gradient(135deg, ${brandDNA.colors.primary}, ${brandDNA.colors.accent})`
                : "linear-gradient(135deg, #7C6EF8, #A89DF9)",
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
