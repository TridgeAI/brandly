"use client";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ChipGroup } from "@/components/onboarding/kit";
import type { BrandModel, LayoutId, LayoutKit } from "@/lib/brand/model";
import { LAYOUT_LABELS, layoutKitOf, SELECTABLE_LAYOUTS } from "@/lib/render/kit";

const SELECTS: { key: keyof LayoutKit; label: string; options: { value: string; label: string }[] }[] = [
  { key: "background", label: "Background colour", options: ["primary", "secondary", "accent", "neutral"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })) },
  { key: "headlineCase", label: "Headline case", options: [{ value: "sentence", label: "Sentence case" }, { value: "title", label: "Title Case" }, { value: "upper", label: "UPPERCASE" }] },
  { key: "photoTreatment", label: "Photos", options: [{ value: "full", label: "Full colour" }, { value: "framed", label: "In a frame" }, { value: "duotone", label: "Duotone (brand colour)" }] },
  { key: "accentShape", label: "Accent shape", options: ["bar", "underline", "circle", "corner", "none"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })) },
  { key: "logoPosition", label: "Logo", options: ["top-left", "top-right", "bottom-left", "bottom-right"].map((v) => ({ value: v, label: v.replace("-", " ") })) },
];

/** Edit the brand's post layout kit, with a live rendered preview. */
export function LayoutKitEditor({ model, onChange }: { model: BrandModel; onChange: (kit: LayoutKit) => void }) {
  const kit = layoutKitOf(model)!;
  const [previewLayout, setPreviewLayout] = useState<LayoutId>(kit.layouts[0] ?? "photo-band");
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const set = (patch: Partial<LayoutKit>) => onChange({ ...kit, ...patch });

  const kitKey = JSON.stringify([kit, model.expression.tokens, model.expression.logoPath, model.expression.photos?.[0]?.path]);
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const photo = model.expression.photos?.[0];
        const res = await fetch("/api/render-post", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brandModel: model,
            layout: previewLayout,
            size: "1080x1350",
            photo: photo ? { kind: "brand", ref: photo.path } : null,
            post: {
              caption: model.identity.oneLiner || model.name,
              headline: (model.voice.sampleLines[0] || model.identity.oneLiner || model.name).split(/\s+/).slice(0, 9).join(" "),
              subline: model.strategy.offering?.slice(0, 60),
              cta: "Learn more",
              items: (model.content.pillars.length ? model.content.pillars : ["First point", "Second point", "Third point"]).slice(0, 3),
              stat: "3x",
              slides: previewLayout === "carousel-cover" ? [{ headline: model.content.pillars[0] ?? model.name }, { headline: "Slide two" }] : [],
            },
          }),
        });
        const data = await res.json();
        if (data.rendered?.urls?.[0]) setPreview(data.rendered.urls[0]);
      } catch {
        /* keep the last preview */
      }
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kitKey, previewLayout]);

  return (
    <div className="grid sm:grid-cols-[1fr_220px] gap-6">
      <div className="space-y-5">
        <div>
          <p className="text-sm font-medium mb-1">Layouts this brand uses</p>
          <p className="text-xs text-text-muted mb-2">Posts rotate through these. Pick 5–7.</p>
          <ChipGroup
            multi
            options={SELECTABLE_LAYOUTS.map((l) => ({ value: l, label: LAYOUT_LABELS[l] }))}
            value={kit.layouts}
            onChange={(v) => v.length && set({ layouts: v as LayoutId[] })}
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {SELECTS.map((s) => (
            <label key={s.key} className="block">
              <span className="text-xs text-text-muted">{s.label}</span>
              <select
                value={String(kit[s.key])}
                onChange={(e) => set({ [s.key]: e.target.value } as Partial<LayoutKit>)}
                className="mt-1 w-full h-9 rounded-lg border border-border bg-surface px-2 text-sm capitalize"
              >
                {s.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label className="block">
            <span className="text-xs text-text-muted">Corner roundness ({kit.radius}px)</span>
            <input type="range" min={0} max={48} step={4} value={kit.radius} onChange={(e) => set({ radius: Number(e.target.value) })} className="mt-3 w-full" />
          </label>
        </div>
      </div>
      <div>
        <div className="flex flex-wrap gap-1 mb-2">
          {kit.layouts.map((l) => (
            <button
              key={l}
              onClick={() => setPreviewLayout(l)}
              className={clsx("text-[10px] px-2 py-1 rounded-full border", previewLayout === l ? "bg-text text-bg border-text" : "border-border text-text-muted hover:text-text")}
            >
              {LAYOUT_LABELS[l]}
            </button>
          ))}
        </div>
        <div className={clsx("aspect-[4/5] rounded-xl overflow-hidden border border-border bg-surface transition-opacity", loading && "opacity-60")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview ? <img src={preview} alt={`${LAYOUT_LABELS[previewLayout]} preview`} className="w-full h-full object-cover" /> : null}
        </div>
      </div>
    </div>
  );
}
