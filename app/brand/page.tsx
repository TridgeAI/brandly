"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { AlertTriangle, ArrowRight, Plus, RefreshCw, X } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Button, Card, EmptyState, Input, Select, Textarea } from "@/components/ui";
import { BUSINESS_MODELS, INDUSTRIES, PRIMARY_GOALS, type BusinessModel, type Industry, type PrimaryGoal } from "@/lib/brand/taxonomy";
import { ChipGroup, LockButton, SourceTag, TierCards } from "@/components/onboarding/kit";
import { BrandPostPreview } from "@/components/brand/BrandPreview";
import { DeleteBrandDialog } from "@/components/brand/DeleteBrandDialog";
import { LayoutKitEditor } from "@/components/brand/LayoutKitEditor";
import { BrandPhotos } from "@/components/brand/BrandPhotos";
import { useStore } from "@/lib/store";
import { fromBrandDNA } from "@/lib/brand/projection";
import { isLocked, mergePatch, sectionConfidence, setLock } from "@/lib/brand/merge";
import { AGE_GROUPS, MOMENTS, MOTIVATIONS, type BrandModel, type ModelPatch, type Tone } from "@/lib/brand/model";
import { AFFLUENCE_OPTIONS, AGE_LABELS, complianceFor, GENDER_OPTIONS, LANGUAGE_OPTIONS, MOMENT_LABELS, MOTIVATION_LABELS } from "@/lib/brand/audience";
import { checkPalette, contrastRatio, normalizeHex, readableOn, wcagLevel } from "@/lib/brand/color";
import { FONT_CHOICES } from "@/lib/brand/fonts";
import { loadGoogleFonts } from "@/lib/brand/client";

const NEEDS_CHECK = 0.6;

// ── Section card with source tag + lock ────────────────────────────────────
function Section({
  id,
  title,
  description,
  model,
  onLock,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  model: BrandModel;
  onLock: (path: string, locked: boolean) => void;
  children: React.ReactNode;
}) {
  const c = sectionConfidence(model, id);
  const needsCheck = c.source !== "user" && !c.locked && c.confidence > 0 && c.confidence < NEEDS_CHECK;
  const empty = c.confidence === 0;
  const locked = !!model.meta[id]?.locked;
  return (
    <Card className={clsx("p-5", needsCheck && "border-warn/40")}>
      <div id={`section-${id}`} className="flex items-start justify-between gap-3 mb-4 scroll-mt-6">
        <div>
          <h2 className="font-medium">{title}</h2>
          {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SourceTag source={empty ? undefined : c.source} needsCheck={needsCheck || (empty && id === "strategy.audience")} />
          <LockButton locked={locked} onToggle={() => onLock(id, !locked)} />
        </div>
      </div>
      {children}
    </Card>
  );
}

// ── Voice slider ───────────────────────────────────────────────────────────
function ToneSlider({ left, right, value, onChange }: { left: string; right: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="flex justify-between text-xs text-text-muted mb-2">
        <span className={clsx(value < -0.2 && "text-text font-medium")}>{left}</span>
        <span className={clsx(value > 0.2 && "text-text font-medium")}>{right}</span>
      </span>
      <input
        type="range"
        className="tone"
        min={-1}
        max={1}
        step={0.1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`${left} to ${right}`}
      />
    </label>
  );
}

// ── Editable list (pillars, hashtags, rules) ───────────────────────────────
function ListEditor({ items, onChange, placeholder }: { items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    if (!draft.trim()) return;
    onChange([...items, draft.trim()]);
    setDraft("");
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {items.map((it, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 min-h-8 py-1 pl-3 pr-1.5 rounded-2xl border border-border bg-bg text-sm leading-snug max-w-full">
            {it}
            <button onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={`Remove ${it}`} className="w-5 h-5 grid place-items-center rounded-full text-text-muted hover:text-text hover:bg-text/5">
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder={placeholder} className="h-9" />
        <Button variant="secondary" size="sm" className="h-9" onClick={add} aria-label="Add">
          <Plus size={14} />
        </Button>
      </div>
    </div>
  );
}

function BrandProfile() {
  const params = useSearchParams();
  const welcome = params.get("welcome") === "1";
  const { getActiveBrand, saveBrandModel } = useStore();
  const brand = getActiveBrand();

  // Older brands may not have a model yet: wrap the DNA on the fly.
  const model = useMemo(() => (brand ? brand.model ?? fromBrandDNA(brand.dna, brand.id) : null), [brand]);
  const [voiceLine, setVoiceLine] = useState<string | null>(null);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const voiceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (model) loadGoogleFonts([model.expression.tokens.font.heading.$value, model.expression.tokens.font.body.$value]);
  }, [model]);

  if (!brand || !model) {
    return (
      <EmptyState
        title="No brand yet"
        description="Set up your brand first. It takes about two minutes."
        action={
          <Link href="/onboarding">
            <Button>Set up your brand</Button>
          </Link>
        }
      />
    );
  }

  const save = (next: BrandModel) => saveBrandModel(next, brand.sources);
  // User edits always win and lock the edited fields.
  const edit = (patch: ModelPatch) => save(mergePatch(model, patch, { source: "user", confidence: 1, lock: true }).model);
  const lock = (path: string, locked: boolean) => save(setLock(model, path, locked));

  const c = model.expression.tokens.color;
  const palette = { primary: c.primary.$value, secondary: c.secondary.$value, accent: c.accent.$value, neutral: c.neutral.$value };
  const paletteCheck = checkPalette(palette);
  const a = model.strategy.audience;
  const fonts = { heading: model.expression.tokens.font.heading.$value, body: model.expression.tokens.font.body.$value };
  const compliance = complianceFor(a);

  const sections = ["identity", "expression.tokens.color", "expression.tokens.font", "voice", "strategy.audience", "content"];
  const toCheck = sections.filter((s) => {
    const sc = sectionConfidence(model, s);
    return (sc.source !== "user" && !sc.locked && sc.confidence > 0 && sc.confidence < NEEDS_CHECK) || (s === "strategy.audience" && sc.confidence === 0);
  });

  const refreshVoiceLine = (m: BrandModel) => {
    clearTimeout(voiceTimer.current);
    voiceTimer.current = setTimeout(async () => {
      setVoiceLoading(true);
      try {
        const res = await fetch(`/api/brands/${m.id}/voice-sample`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: m }),
        });
        const data = await res.json();
        if (data.line) setVoiceLine(data.line);
      } catch {
        /* keep the previous line */
      }
      setVoiceLoading(false);
    }, 700);
  };

  const setTone = (key: keyof Tone, v: number) => {
    const next = mergePatch(model, { voice: { tone: { ...model.voice.tone, [key]: v } } }, { source: "user", confidence: 1, lock: true }).model;
    save(next);
    refreshVoiceLine(next);
  };

  const setColor = (role: keyof typeof palette, raw: string) => {
    const hex = normalizeHex(raw);
    if (!hex) return;
    edit({ expression: { tokens: { color: { [role]: { $type: "color", $value: hex } } } } });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div className="min-w-0">
          <p className="text-xs text-text-muted">Brand profile</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-0.5">{model.name}</h1>
          {model.identity.oneLiner && <p className="text-text-muted mt-1 text-sm max-w-xl">{model.identity.oneLiner}</p>}
        </div>
        <Link href="/composer">
          <Button size="lg">
            Looks good, create a post <ArrowRight size={16} />
          </Button>
        </Link>
      </div>

      {(welcome || toCheck.length > 0) && (
        <div className={clsx("rounded-xl border px-4 py-3 mb-6 text-sm flex items-start gap-3", toCheck.length ? "border-warn/30 bg-warn/[0.06]" : "border-border bg-card")}>
          {toCheck.length > 0 && <AlertTriangle size={16} className="text-warn mt-0.5 shrink-0" />}
          <div>
            {toCheck.length > 0 ? (
              <>
                <p className="font-medium">
                  {toCheck.length} {toCheck.length === 1 ? "thing" : "things"} to check
                </p>
                <p className="text-text-muted mt-0.5">
                  Brandly wasn&apos;t sure about these. Fix anything that&apos;s off, or lock what&apos;s right.{" "}
                  {toCheck.map((s, i) => (
                    <a key={s} href={`#section-${s}`} className="underline underline-offset-2 hover:text-text">
                      {SECTION_NAMES[s]}
                      {i < toCheck.length - 1 ? ", " : ""}
                    </a>
                  ))}
                </p>
              </>
            ) : (
              <p>Here&apos;s your brand. Everything is editable, and anything you change is locked so Brandly won&apos;t overwrite it.</p>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6 min-w-0">
          <Section id="identity" title="About" description="What you are, in plain words" model={model} onLock={lock}>
            <div className="space-y-4">
              <Input label="One-liner" defaultValue={model.identity.oneLiner} onBlur={(e) => e.target.value !== model.identity.oneLiner && edit({ identity: { oneLiner: e.target.value } })} />
              <Textarea label="What you sell" rows={2} defaultValue={model.strategy.offering} onBlur={(e) => e.target.value !== model.strategy.offering && edit({ strategy: { offering: e.target.value } })} />
              <Textarea label="Your promise" rows={2} defaultValue={model.strategy.promise} onBlur={(e) => e.target.value !== model.strategy.promise && edit({ strategy: { promise: e.target.value } })} />
              <div className="grid gap-4 sm:grid-cols-3">
                <Select
                  label="Industry"
                  options={INDUSTRIES}
                  value={model.strategy.industry ?? ""}
                  onChange={(v) => v && edit({ strategy: { industry: v as Industry } })}
                />
                <Select
                  label="How you sell"
                  options={BUSINESS_MODELS}
                  value={model.strategy.businessModel ?? ""}
                  onChange={(v) => v && edit({ strategy: { businessModel: v as BusinessModel } })}
                />
                <Select
                  label="Main goal"
                  options={PRIMARY_GOALS}
                  value={model.strategy.primaryGoal ?? ""}
                  onChange={(v) => v && edit({ strategy: { primaryGoal: v as PrimaryGoal } })}
                />
              </div>
            </div>
          </Section>

          <Section id="expression.tokens.color" title="Colours" description="Used in post designs and image prompts" model={model} onLock={lock}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(Object.keys(palette) as (keyof typeof palette)[]).map((role) => (
                <div key={role}>
                  <label className="block rounded-xl border border-border overflow-hidden cursor-pointer">
                    <span className="block h-20 relative" style={{ background: palette[role] }}>
                      <input type="color" value={palette[role]} onChange={(e) => setColor(role, e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" aria-label={`${role} colour`} />
                      <span className="absolute bottom-2 left-2 text-[11px] font-medium" style={{ color: readableOn(palette[role]) }}>
                        Aa
                      </span>
                    </span>
                  </label>
                  <p className="text-xs text-text-muted mt-2 capitalize">{role === "neutral" ? "Background" : role}</p>
                  <input
                    key={palette[role]}
                    defaultValue={palette[role]}
                    onBlur={(e) => setColor(role, e.target.value)}
                    className="w-full mt-0.5 font-mono text-sm bg-transparent border-b border-transparent hover:border-border focus:border-text/40 focus:outline-none"
                    aria-label={`${role} hex`}
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full border border-border">
                Text on primary: {paletteCheck.textOnPrimary.toFixed(1)}:1 · {wcagLevel(paletteCheck.textOnPrimary)}
              </span>
              <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full border border-border">
                Primary on background: {contrastRatio(palette.primary, palette.neutral).toFixed(1)}:1
              </span>
            </div>
            {paletteCheck.issues.map((i) => (
              <p key={i} className="text-xs text-warn mt-2">
                {i}
              </p>
            ))}
          </Section>

          <Section id="expression.tokens.font" title="Fonts" model={model} onLock={lock}>
            <div className="grid sm:grid-cols-2 gap-4">
              {(["heading", "body"] as const).map((role) => (
                <div key={role} className="rounded-xl border border-border p-4">
                  <p className="text-xs text-text-muted capitalize mb-2">{role}</p>
                  <p className={role === "heading" ? "text-2xl font-semibold leading-tight" : "text-sm leading-relaxed"} style={{ fontFamily: `'${fonts[role]}'` }}>
                    {role === "heading" ? model.name : "The quick brown fox jumps over the lazy dog. 0123456789"}
                  </p>
                  <select
                    value={FONT_CHOICES.includes(fonts[role]) ? fonts[role] : "__custom"}
                    onChange={(e) => {
                      if (e.target.value === "__custom") return;
                      loadGoogleFonts([e.target.value]);
                      edit({ expression: { tokens: { font: { [role]: { $type: "fontFamily", $value: e.target.value } } } } });
                    }}
                    className="mt-3 w-full h-9 rounded-lg border border-border bg-surface px-2 text-sm"
                    aria-label={`${role} font`}
                  >
                    {!FONT_CHOICES.includes(fonts[role]) && <option value="__custom">{fonts[role]} (from your site)</option>}
                    {FONT_CHOICES.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </Section>

          <Section id="expression.layoutKit" title="Post layouts" description="How your posts look: Brandly lays out every image with your fonts, colours and logo" model={model} onLock={lock}>
            <LayoutKitEditor model={model} onChange={(kit) => edit({ expression: { layoutKit: kit } })} />
          </Section>

          <Section id="expression.photos" title="Brand photos" description="Real photos used in product, offer and testimonial posts" model={model} onLock={lock}>
            <BrandPhotos model={model} onChange={(photos) => save({ ...model, expression: { ...model.expression, photos } })} />
          </Section>

          <Section id="voice" title="Voice" description="Move the sliders and watch the sample line change" model={model} onLock={lock}>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
              <ToneSlider left="Funny" right="Serious" value={model.voice.tone.funny_serious} onChange={(v) => setTone("funny_serious", v)} />
              <ToneSlider left="Formal" right="Casual" value={model.voice.tone.formal_casual} onChange={(v) => setTone("formal_casual", v)} />
              <ToneSlider left="Respectful" right="Cheeky" value={model.voice.tone.respectful_irreverent} onChange={(v) => setTone("respectful_irreverent", v)} />
              <ToneSlider left="Enthusiastic" right="Matter-of-fact" value={model.voice.tone.enthusiastic_matter} onChange={(v) => setTone("enthusiastic_matter", v)} />
            </div>
            <div className="mt-5 rounded-xl bg-bg border border-border p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-text-muted">Sample line</p>
                <button onClick={() => refreshVoiceLine(model)} className="text-xs text-text-muted hover:text-text inline-flex items-center gap-1">
                  <RefreshCw size={12} className={clsx(voiceLoading && "animate-spin")} /> Rewrite
                </button>
              </div>
              <p className={clsx("text-[15px] leading-snug transition-opacity", voiceLoading && "opacity-50")}>
                {voiceLine ?? model.voice.sampleLines[0] ?? "Move a slider to see a sample line in your voice."}
              </p>
            </div>
            <div className="mt-5">
              <Textarea
                label="How you write"
                rows={2}
                defaultValue={model.voice.description}
                onBlur={(e) => e.target.value !== model.voice.description && edit({ voice: { description: e.target.value } })}
              />
            </div>
          </Section>

          <Section id="strategy.audience" title="Audience" description="Shapes colours, voice and which platforms to post on" model={model} onLock={lock}>
            <div className="space-y-5">
              <div>
                <p className="text-sm font-medium mb-2">Mostly</p>
                <ChipGroup options={GENDER_OPTIONS} value={a.gender ? [a.gender] : []} onChange={(v) => edit({ strategy: { audience: { gender: v[0] } } })} />
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Age groups</p>
                <ChipGroup multi options={AGE_GROUPS.map((x) => ({ value: x, label: AGE_LABELS[x] }))} value={a.ageGroups} onChange={(v) => edit({ strategy: { audience: { ageGroups: v } } })} />
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Spending level</p>
                <TierCards options={AFFLUENCE_OPTIONS} value={a.affluence} onChange={(v) => edit({ strategy: { audience: { affluence: v } } })} />
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Post languages</p>
                <ChipGroup multi options={LANGUAGE_OPTIONS.map((l) => ({ value: l, label: l }))} value={a.languages} onChange={(v) => edit({ strategy: { audience: { languages: v } } })} />
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Why they buy (up to 2)</p>
                <ChipGroup multi max={2} options={MOTIVATIONS.map((m) => ({ value: m, label: MOTIVATION_LABELS[m] }))} value={a.motivations} onChange={(v) => edit({ strategy: { audience: { motivations: v } } })} />
              </div>
              <div>
                <p className="text-sm font-medium mb-2">When they think of you</p>
                <ChipGroup multi options={MOMENTS.map((m) => ({ value: m, label: MOMENT_LABELS[m] }))} value={a.moments} onChange={(v) => edit({ strategy: { audience: { moments: v } } })} />
              </div>
              {compliance.minorsInAudience && (
                <p className="text-xs text-text-muted border-t border-border pt-4">
                  Your audience includes under-18s, so posts will avoid {compliance.restrictedTopics.join(", ")}.
                </p>
              )}
            </div>
          </Section>

          <Section id="content" title="What to post about" model={model} onLock={lock}>
            <div className="space-y-6">
              <div>
                <p className="text-sm font-medium mb-2">Content pillars</p>
                <ListEditor items={model.content.pillars} onChange={(v) => edit({ content: { pillars: v } })} placeholder="Add a pillar, e.g. Behind the scenes" />
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Hashtags</p>
                <ListEditor items={model.content.hashtagClusters} onChange={(v) => edit({ content: { hashtagClusters: v } })} placeholder="#yourhashtag" />
              </div>
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium mb-2">Always</p>
                  <ListEditor items={model.content.do} onChange={(v) => edit({ content: { do: v } })} placeholder="Add a rule" />
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Never</p>
                  <ListEditor items={model.content.dont} onChange={(v) => edit({ content: { dont: v } })} placeholder="Add a rule" />
                </div>
              </div>
            </div>
          </Section>

          <Card className="p-5 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-medium">Delete this brand</h2>
              <p className="text-xs text-text-muted mt-0.5">Removes the profile and all of its posts and automations.</p>
            </div>
            <DeleteBrandDialog brandId={brand.id} brandName={model.name} />
          </Card>
        </div>

        {/* Sticky live preview */}
        <aside className="lg:sticky lg:top-6 self-start space-y-3">
          <p className="text-xs text-text-muted">Preview</p>
          <BrandPostPreview
            name={model.name}
            headline={model.identity.oneLiner || model.name}
            caption={model.voice.sampleLines[0] ?? model.identity.oneLiner}
            palette={palette}
            fonts={fonts}
            imageUrl={undefined}
          />
          {model.expression.logoUrl && (
            <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={model.expression.logoUrl} alt="Logo" className="h-10 w-10 object-contain rounded bg-white border border-border" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Logo</p>
                <p className="text-xs text-text-muted truncate">{isLocked(model, "expression.logoUrl") ? "Locked" : "From your website"}</p>
              </div>
            </div>
          )}
          <p className="text-xs text-text-muted leading-relaxed">
            Version {model.version} · {model.mode === "build" ? "Built with Brandly" : model.mode === "refine" ? "Refined from your website" : "Read from your sources"}
          </p>
        </aside>
      </div>
    </div>
  );
}

const SECTION_NAMES: Record<string, string> = {
  identity: "About",
  "expression.tokens.color": "Colours",
  "expression.tokens.font": "Fonts",
  voice: "Voice",
  "strategy.audience": "Audience",
  content: "What to post about",
};

export default function BrandPage() {
  return (
    <AppShell>
      <Suspense>
        <BrandProfile />
      </Suspense>
    </AppShell>
  );
}
