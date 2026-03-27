"use client";
import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { useStore } from "@/lib/store";
import { Button, Input, Textarea, Card, Chip, SectionLabel, PageHeader, EmptyState } from "@/components/ui";
import PlatformPreview from "@/components/composer/PlatformPreview";
import Link from "next/link";
import type { GeneratedPost, Platform, TemplateCategory, ScheduledPost } from "@/lib/types";
import { CONTENT_TEMPLATES, PLATFORM_ICONS, PLATFORM_LABELS } from "@/lib/templates";
import { format, addDays } from "date-fns";

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
  const [scheduleDate, setScheduleDate] = useState(
    format(addDays(new Date(), 1), "yyyy-MM-dd'T'HH:mm")
  );
  const [saved, setSaved] = useState(false);

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const generate = async () => {
    if (!brand || selectedPlatforms.length === 0) return;
    setGenerating(true);
    setPost(null);
    setSaved(false);
    const res = await fetch("/api/generate-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandDNA: brand.dna,
        template: selectedTemplate,
        topic,
        platforms: selectedPlatforms,
        tone: tone === "Brand default" ? undefined : tone,
        additionalContext,
      }),
    });
    const data = await res.json();
    setPost(data.post ?? null);
    setGenerating(false);
  };

  const schedulePost = (status: "draft" | "scheduled") => {
    if (!post || !brand) return;
    const scheduled: ScheduledPost = {
      id: `post_${Date.now()}`,
      brandId: brand.id,
      content: post,
      platforms: selectedPlatforms,
      scheduledAt: new Date(scheduleDate).toISOString(),
      status,
      createdAt: new Date().toISOString(),
    };
    addPost(scheduled);
    setSaved(true);
  };

  if (!brand) {
    return (
      <AppShell>
        <div className="p-8">
          <EmptyState
            icon="✦"
            title="No brand selected"
            description="Build your Brand DNA first — the composer uses it to generate on-brand content."
            action={
              <Link href="/onboarding">
                <Button>Build Brand DNA →</Button>
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
                    <span className="text-lg block mb-1">{t.icon}</span>
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
                    <span>{PLATFORM_ICONS[p]}</span>
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
              {generating ? "Generating…" : "✦ Generate Post"}
            </Button>
          </div>

          {/* ── Right: Output ── */}
          <div className="col-span-3 space-y-5">
            {!post && !generating && (
              <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-center gap-4 border-2 border-dashed border-border rounded-2xl">
                <div className="text-5xl opacity-30">✏️</div>
                <p className="font-semibold text-text">Your generated post will appear here</p>
                <p className="text-sm text-text-muted max-w-xs">
                  Select a template, choose platforms, and hit Generate.
                </p>
              </div>
            )}

            {generating && (
              <div className="flex flex-col items-center justify-center h-full min-h-[500px] gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent to-accent-light flex items-center justify-center text-xl animate-spin-slow">
                  ✦
                </div>
                <p className="text-text-muted">Writing on-brand content…</p>
                <div className="flex flex-col gap-2 text-xs text-text-muted text-center">
                  <p>✦ Applying {brand.name} Brand DNA</p>
                  <p>✦ Adapting for {selectedPlatforms.join(", ")}</p>
                  <p>✦ Generating image prompt & CTA</p>
                </div>
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
                />

                {/* All captions */}
                {selectedPlatforms.length > 1 && (
                  <Card className="p-5">
                    <SectionLabel>All Platform Variants</SectionLabel>
                    <div className="space-y-4">
                      {selectedPlatforms.map((p) => (
                        <div key={p}>
                          <p className="text-xs font-semibold text-text-muted mb-1.5">
                            {PLATFORM_ICONS[p]} {PLATFORM_LABELS[p]}
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

                {/* Image prompt */}
                <Card className="p-5">
                  <SectionLabel>AI Image Generation Prompt</SectionLabel>
                  <p className="text-sm text-text-muted leading-relaxed bg-surface p-3 rounded-xl">
                    {post.imagePrompt}
                  </p>
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
                      <Button variant="ghost" onClick={() => schedulePost("draft")} disabled={saved}>
                        Save Draft
                      </Button>
                      <Button onClick={() => schedulePost("scheduled")} disabled={saved}>
                        {saved ? "✓ Scheduled!" : "📅 Schedule Post"}
                      </Button>
                    </div>
                  </div>
                </Card>

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
