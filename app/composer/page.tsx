"use client";
import { useEffect, useRef, useState } from "react";
import { PlatformIcon, TemplateIcon, TriggerIcon } from "@/components/ui/icons";
import AppShell from "@/components/layout/AppShell";
import { useStore } from "@/lib/store";
import { Button, Input, Textarea, Card, Chip, SectionLabel, PageHeader, EmptyState } from "@/components/ui";
import PlatformPreview from "@/components/composer/PlatformPreview";
import Link from "next/link";
import type { GeneratedPost, Platform, RenderedMedia, TemplateCategory, ScheduledPost } from "@/lib/types";
import type { LayoutId } from "@/lib/brand/model";
import { LAYOUT_LABELS, layoutKitOf } from "@/lib/render/kit";
import { CONTENT_TEMPLATES, PLATFORM_LABELS } from "@/lib/templates";
import { format, addDays } from "date-fns";
import { sendFeedback, track } from "@/lib/track";

const BAD_REASONS = ["Off-brand", "Wrong tone", "Too long", "Too generic", "Wrong facts"];

const PLATFORMS: Platform[] = ["instagram", "facebook", "linkedin", "twitter"];
const TONES = ["Brand default", "Witty & playful", "Professional", "Inspirational", "Educational", "Urgent"];

export default function ComposerPage() {
  const { getActiveBrand, addPost } = useStore();
  const brand = getActiveBrand();

  const [selectedTemplate, setSelectedTemplate] = useState<TemplateCategory>("product_launch");
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(["instagram"]);
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("Brand default");
  const [additionalContext, setAdditionalContext] = useState("");
  const [generating, setGenerating] = useState(false);
  const [post, setPost] = useState<GeneratedPost | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [rating, setRating] = useState<1 | -1 | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState(
    format(addDays(new Date(), 1), "yyyy-MM-dd'T'HH:mm")
  );
  const [saved, setSaved] = useState(false);
  const [size, setSize] = useState<RenderedMedia["size"]>("1080x1350");
  const [rendered, setRendered] = useState<RenderedMedia | null>(null);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const renderSeq = useRef(0);
  const textTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(textTimer.current), []);

  type PhotoChoice = RenderedMedia["photo"] | null | "auto" | "generate";
  const callRender = async (p: GeneratedPost, o: { layout?: LayoutId; photo?: PhotoChoice; size?: RenderedMedia["size"]; store?: boolean; key?: string }) => {
    const res = await fetch("/api/render-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandModel: brand?.model, post: p, layout: o.layout ?? p.layout, photo: o.photo, size: o.size ?? size, store: o.store, key: o.key }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.rendered) throw new Error(data.error ?? `Couldn't make the image (HTTP ${res.status})`);
    return data.rendered as RenderedMedia;
  };

  /** Renders the branded preview. Only the latest request updates the screen. */
  const renderPreview = async (p: GeneratedPost, o: { layout?: LayoutId; photo?: PhotoChoice; size?: RenderedMedia["size"] } = {}) => {
    if (!brand?.model) return;
    const seq = ++renderSeq.current;
    setRendering(true);
    setRenderError(null);
    try {
      const r = await callRender(p, o);
      if (seq !== renderSeq.current) return;
      setRendered(r);
      setSaved(false);
      if (o.photo === "generate" && generationId) track("image_generated", { generationId, props: { layout: r.layout } });
    } catch (err) {
      if (seq === renderSeq.current) setRenderError(err instanceof Error ? err.message : String(err));
    }
    if (seq === renderSeq.current) setRendering(false);
  };

  // Keep the photo already chosen when only the layout or text changes.
  const currentPhoto = (): PhotoChoice => rendered?.photo ?? "auto";

  const switchLayout = (l: LayoutId) => {
    if (!post) return;
    const next = { ...post, layout: l };
    setPost(next);
    renderPreview(next, { layout: l, photo: currentPhoto() });
  };

  /** Editing the image text re-renders without another AI call. */
  const editVisualText = (field: "headline" | "subline", value: string) => {
    if (!post) return;
    const next = { ...post, [field]: value };
    setPost(next);
    clearTimeout(textTimer.current);
    textTimer.current = setTimeout(() => renderPreview(next, { photo: currentPhoto() }), 600);
  };

  const brandPhotos = brand?.model?.expression.photos ?? [];
  const nextBrandPhoto = () => {
    if (!post || !brandPhotos.length) return;
    const i = brandPhotos.findIndex((p) => p.path === rendered?.photo?.ref);
    renderPreview(post, { photo: { kind: "brand", ref: brandPhotos[(i + 1) % brandPhotos.length].path } });
  };

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const generate = async () => {
    if (!brand || selectedPlatforms.length === 0) return;
    // Asking again for the same request means the last one wasn't good enough.
    if (post && generationId && !saved) track("regenerated", { generationId });
    setGenerating(true);
    setGenError(null);
    setRating(null);
    setReasons([]);
    setFeedbackSent(false);
    setPost(null);
    setSaved(false);
    setRendered(null);
    setRenderError(null);
    const res = await fetch("/api/generate-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandDNA: brand.dna,
        brandModel: brand.model,
        template: selectedTemplate,
        topic,
        platforms: selectedPlatforms,
        tone: tone === "Brand default" ? undefined : tone,
        additionalContext,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setPost(data.post ?? null);
    setGenerationId(data.generationId ?? null);
    if (!data.post) setGenError(data.error ?? "Couldn't write a post. Please try again.");
    setGenerating(false);
    if (data.post) renderPreview(data.post, { photo: "auto" });
  };

  const schedulePost = async (status: "draft" | "scheduled") => {
    if (!post || !brand) return;
    const id = crypto.randomUUID();
    setSaving(true);
    let content: GeneratedPost = { ...post, rendered: undefined };
    // The preview only lives in the browser: save the branded image(s) to storage now.
    if (rendered) {
      try {
        const stored = await callRender(post, { layout: rendered.layout, photo: rendered.photo ?? null, size: rendered.size, store: true, key: id });
        content = { ...post, layout: stored.layout, rendered: stored };
      } catch (err) {
        setRenderError(err instanceof Error ? err.message : String(err));
        setSaving(false);
        return;
      }
    }
    const scheduled: ScheduledPost = {
      id,
      brandId: brand.id,
      content,
      generationId: generationId ?? undefined,
      platforms: selectedPlatforms,
      scheduledAt: new Date(scheduleDate).toISOString(),
      status,
      createdAt: new Date().toISOString(),
      ...(content.rendered?.urls[0] ? { mediaUrl: content.rendered.urls[0] } : {}),
    };
    addPost(scheduled, { template: selectedTemplate, topic: topic || undefined });
    setSaving(false);
    setSaved(true);
  };

  const kit = layoutKitOf(brand?.model);

  if (!brand) {
    return (
      <AppShell>
        <div className="p-8">
          <EmptyState
            title="No brand selected"
            description="Set up your brand first. Brandly uses it to write posts that sound like you."
            action={
              <Link href="/onboarding">
                <Button>Set up your brand</Button>
              </Link>
            }
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-8 max-w-7xl mx-auto">
        <PageHeader
          title="AI Composer"
          subtitle={`Creating content for ${brand.name}`}
        />

        <div className="grid grid-cols-5 gap-6">
          {/* ── Left: Controls ── */}
          <div className="col-span-2 space-y-5">

            {/* Template picker */}
            <Card className="p-5">
              <SectionLabel>Content Template</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {CONTENT_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTemplate(t.id)}
                    className={`p-3 rounded-xl text-left transition-all border text-xs ${
                      selectedTemplate === t.id
                        ? "bg-accent/10 border-accent/40 text-text"
                        : "border-border text-text-muted hover:border-accent/30 hover:text-text"
                    }`}
                  >
                    <span className="block mb-1.5"><TemplateIcon id={t.id} /></span>
                    <span className="font-medium">{t.label}</span>
                  </button>
                ))}
              </div>
            </Card>

            {/* Platforms */}
            <Card className="p-5">
              <SectionLabel>Platforms</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    onClick={() => togglePlatform(p)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium border transition-all ${
                      selectedPlatforms.includes(p)
                        ? "bg-accent/10 border-accent/40 text-text"
                        : "border-border text-text-muted hover:border-accent/30"
                    }`}
                  >
                    <span><PlatformIcon platform={p} /></span>
                    {PLATFORM_LABELS[p]}
                  </button>
                ))}
              </div>
            </Card>

            {/* Topic & tone */}
            <Card className="p-5 space-y-4">
              <Input
                label="Topic / Focus"
                placeholder="e.g. New summer collection launch"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
              <div>
                <SectionLabel>Tone Override</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {TONES.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTone(t)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                        tone === t
                          ? "bg-accent/10 border-accent/40 text-accent-light"
                          : "border-border text-text-muted hover:border-accent/30 hover:text-text"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <Textarea
                label="Additional Context"
                placeholder="Any specific details, promotions, or angles to include…"
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                rows={3}
              />
            </Card>

            {/* Brand DNA at a glance */}
            <Card className="p-5">
              <SectionLabel>Active Brand DNA</SectionLabel>
              <div className="flex gap-1.5 mb-3">
                {Object.entries(brand.dna.colors).map(([, hex]) => (
                  <div key={hex} className="w-5 h-5 rounded" style={{ background: hex }} />
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {brand.dna.vibe.slice(0, 3).map((v) => (
                  <Chip key={v} variant="accent" className="text-[10px]">{v}</Chip>
                ))}
              </div>
              <p className="text-xs text-text-muted">{brand.dna.communication_tone}</p>
            </Card>

            <Button
              className="w-full"
              size="lg"
              loading={generating}
              disabled={selectedPlatforms.length === 0}
              onClick={generate}
            >
              {generating ? "Writing…" : "Write post"}
            </Button>
          </div>

          {/* ── Right: Output ── */}
          <div className="col-span-3 space-y-5">
            {!post && !generating && (
              <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-center gap-4 border-2 border-dashed border-border rounded-2xl">
                <p className="font-medium text-text">Your post will appear here</p>
                <p className="text-sm text-text-muted max-w-xs">
                  Pick what it&apos;s about and where it&apos;s going, then press Write post.
                </p>
                {genError && <p className="text-sm text-error max-w-xs">{genError}</p>}
              </div>
            )}

            {generating && (
              <div className="flex flex-col items-center justify-center h-full min-h-[500px] gap-4">
                <div className="w-full max-w-md space-y-3" aria-hidden>
                  <div className="aspect-square rounded-xl bg-text/5 animate-pulse" />
                  <div className="h-3 rounded bg-text/5 animate-pulse" />
                  <div className="h-3 w-2/3 rounded bg-text/5 animate-pulse" />
                </div>
                <p className="text-sm text-text-muted">
                  Writing for {selectedPlatforms.join(", ")} in {brand.name}&apos;s voice…
                </p>
              </div>
            )}

            {post && !generating && (
              <>
                {/* Platform preview */}
                <PlatformPreview
                  post={post}
                  platforms={selectedPlatforms}
                  brandDNA={brand.dna}
                  igHandle={brand.sources.instagram}
                  images={rendered?.urls ?? []}
                  imageLoading={rendering}
                />

                {/* All captions */}
                {selectedPlatforms.length > 1 && (
                  <Card className="p-5">
                    <SectionLabel>All Platform Variants</SectionLabel>
                    <div className="space-y-4">
                      {selectedPlatforms.map((p) => (
                        <div key={p}>
                          <p className="text-xs font-semibold text-text-muted mb-1.5">
                            <PlatformIcon platform={p} /> {PLATFORM_LABELS[p]}
                          </p>
                          <p className="text-sm leading-relaxed bg-surface p-3 rounded-xl">
                            {post.platformVariants?.[p] ?? post.caption}
                          </p>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Hashtags & metadata */}
                <Card className="p-5 grid grid-cols-2 gap-5">
                  <div>
                    <SectionLabel>Hashtags</SectionLabel>
                    <div className="flex flex-wrap gap-1.5">
                      {post.hashtags.map((h) => (
                        <Chip key={h} variant="neutral" className="text-[11px]">{h}</Chip>
                      ))}
                    </div>
                  </div>
                  <div>
                    <SectionLabel>Metadata</SectionLabel>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-text-muted">Post type</span>
                        <span>{post.postType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">Best time</span>
                        <span>{post.bestTimeToPost}</span>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Branded visual */}
                <Card className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <SectionLabel>Visual</SectionLabel>
                    <div className="flex gap-1" role="group" aria-label="Image size">
                      {(["1080x1350", "1080x1080"] as const).map((sz) => (
                        <button
                          key={sz}
                          aria-pressed={size === sz}
                          onClick={() => {
                            setSize(sz);
                            renderPreview(post, { size: sz, photo: currentPhoto() });
                          }}
                          className={`text-xs px-3 py-1 rounded-full border ${size === sz ? "bg-accent/10 border-accent/40 text-accent-light" : "border-border text-text-muted hover:text-text"}`}
                        >
                          {sz === "1080x1350" ? "4:5" : "1:1"}
                        </button>
                      ))}
                    </div>
                  </div>
                  {kit && (
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Layout">
                      {kit.layouts
                        .filter((l) => l !== "carousel-cover" || (post.slides?.length ?? 0) >= 2)
                        .map((l) => (
                          <button
                            key={l}
                            aria-pressed={(rendered?.layout ?? post.layout) === l}
                            onClick={() => switchLayout(l)}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                              (rendered?.layout ?? post.layout) === l ? "bg-text text-bg border-text" : "border-border text-text-muted hover:text-text"
                            }`}
                          >
                            {LAYOUT_LABELS[l]}
                          </button>
                        ))}
                    </div>
                  )}
                  <Input label="Headline on the image" value={post.headline ?? ""} onChange={(e) => editVisualText("headline", e.target.value)} />
                  <Input label="Supporting line" value={post.subline ?? ""} onChange={(e) => editVisualText("subline", e.target.value)} />
                  <div className="flex gap-2 flex-wrap items-center">
                    {brandPhotos.length > 0 && (
                      <Button size="sm" variant="secondary" disabled={rendering} onClick={nextBrandPhoto}>
                        Use a brand photo
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" disabled={rendering} onClick={() => renderPreview(post, { photo: "generate" })}>
                      New AI photo
                    </Button>
                    {rendering && <span className="text-xs text-text-muted">Laying out your post…</span>}
                  </div>
                  {post.imagePrompt && (
                    <details className="text-xs text-text-muted">
                      <summary className="cursor-pointer">Photo brief</summary>
                      <p className="mt-2 leading-relaxed">{post.imagePrompt}</p>
                    </details>
                  )}
                  {renderError && <p className="text-xs text-error">{renderError}</p>}
                </Card>

                {/* Schedule */}
                <Card className="p-5">
                  <SectionLabel>Schedule or Save</SectionLabel>
                  <div className="flex gap-3 items-end flex-wrap">
                    <div className="flex-1 min-w-[180px]">
                      <label className="block text-xs text-text-muted mb-1.5">Schedule Date & Time</label>
                      <input
                        type="datetime-local"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => schedulePost("draft")} disabled={saved || saving}>
                        Save Draft
                      </Button>
                      <Button onClick={() => schedulePost("scheduled")} disabled={saved || saving} loading={saving}>
                        {saved ? "✓ Scheduled!" : "📅 Schedule Post"}
                      </Button>
                    </div>
                  </div>
                </Card>

                {/* Feedback */}
                {generationId && (
                  <Card className="p-5">
                    {feedbackSent ? (
                      <p className="text-sm text-text-muted">Thanks. This helps Brandly write better posts for you.</p>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <span className="text-sm flex-1">Is this post on-brand?</span>
                          <Button size="sm" variant={rating === 1 ? "primary" : "secondary"} aria-pressed={rating === 1} onClick={() => {
                            setRating(1);
                            sendFeedback({ generationId, rating: 1 }).then(() => setFeedbackSent(true)).catch(() => undefined);
                          }}>
                            Yes
                          </Button>
                          <Button size="sm" variant={rating === -1 ? "primary" : "secondary"} aria-pressed={rating === -1} onClick={() => setRating(-1)}>
                            Not quite
                          </Button>
                        </div>
                        {rating === -1 && (
                          <div className="mt-4 space-y-3">
                            <div className="flex flex-wrap gap-1.5">
                              {BAD_REASONS.map((r) => (
                                <button
                                  key={r}
                                  aria-pressed={reasons.includes(r)}
                                  onClick={() => setReasons((x) => (x.includes(r) ? x.filter((y) => y !== r) : [...x, r]))}
                                  className={`text-xs px-3 py-1.5 rounded-full border ${reasons.includes(r) ? "bg-text text-bg border-text" : "border-border text-text-muted hover:text-text"}`}
                                >
                                  {r}
                                </button>
                              ))}
                            </div>
                            <Button size="sm" onClick={() => sendFeedback({ generationId, rating: -1, reasons }).then(() => setFeedbackSent(true)).catch(() => undefined)}>
                              Send
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </Card>
                )}

                <Button variant="ghost" className="w-full" onClick={generate}>
                  ↺ Regenerate
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
