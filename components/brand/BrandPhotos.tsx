"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import type { BrandModel, BrandPhoto } from "@/lib/brand/model";

/** Grid of the brand's real photos (stored in Supabase), used in product and offer posts. */
export function BrandPhotos({ model, onChange }: { model: BrandModel; onChange: (photos: BrandPhoto[]) => void }) {
  const photos = model.expression.photos ?? [];
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const key = photos.map((p) => p.path).join("|");
  useEffect(() => {
    const missing = photos.filter((p) => !urls[p.path]);
    if (!missing.length) return;
    const q = missing.map((p) => `path=${encodeURIComponent(p.path)}`).join("&");
    fetch(`/api/brands/${model.id}/photos?${q}`)
      .then((r) => r.json())
      .then((d: { photos?: { path: string; url: string }[] }) => setUrls((u) => ({ ...u, ...Object.fromEntries((d.photos ?? []).map((p) => [p.path, p.url])) })))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, model.id]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const added: BrandPhoto[] = [];
    for (const file of [...files].slice(0, 12)) {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/brands/${model.id}/photos`, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (data.photo) {
        added.push(data.photo);
        setUrls((u) => ({ ...u, [data.photo.path]: data.url }));
      } else setError(data.error ?? "Upload failed");
    }
    if (added.length) onChange([...photos, ...added.filter((a) => !photos.some((p) => p.path === a.path))]);
    setBusy(false);
  };

  const remove = (p: BrandPhoto) => {
    onChange(photos.filter((x) => x.path !== p.path));
    fetch(`/api/brands/${model.id}/photos?path=${encodeURIComponent(p.path)}`, { method: "DELETE" }).catch(() => undefined);
  };

  return (
    <div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {photos.map((p) => (
          <div key={p.path} className="relative group aspect-square rounded-lg overflow-hidden bg-surface border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {urls[p.path] && <img src={urls[p.path]} alt="" className="w-full h-full object-cover" />}
            <button
              onClick={() => remove(p)}
              aria-label="Remove photo"
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        <button
          onClick={() => input.current?.click()}
          disabled={busy}
          className="aspect-square rounded-lg border-2 border-dashed border-border text-text-muted hover:text-text hover:border-text/30 flex flex-col items-center justify-center gap-1 text-xs"
        >
          <Plus size={16} />
          {busy ? "Uploading…" : "Add photos"}
        </button>
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
      {error && <p className="text-xs text-error mt-2">{error}</p>}
      {!photos.length && <p className="text-xs text-text-muted mt-2">Add product or team photos. Product and offer posts use these instead of AI images.</p>}
    </div>
  );
}
