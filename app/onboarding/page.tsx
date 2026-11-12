"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import clsx from "clsx";
import { Check, FileUp, RefreshCw, Sprout, Store, X } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Button, Input, Textarea } from "@/components/ui";
import { ChipGroup, ChoiceCard, LiveFindings, OnboardingShell, Question, TierCards } from "@/components/onboarding/kit";
import { BrandPostPreview, PaletteStrip } from "@/components/brand/BrandPreview";
import { useStore } from "@/lib/store";
import { emptyModel, AGE_GROUPS, MOMENTS, MOTIVATIONS, type Affluence, type AgeGroup, type BrandModel, type CityTier, type Gender, type Moment, type Motivation } from "@/lib/brand/model";
import { mergePatch } from "@/lib/brand/merge";
import { AFFLUENCE_OPTIONS, AGE_LABELS, CITY_TIER_LABELS, GENDER_OPTIONS, LANGUAGE_OPTIONS, MOMENT_LABELS, MOTIVATION_LABELS } from "@/lib/brand/audience";
import { scorePersonality, THIS_OR_THAT } from "@/lib/brand/personality";
import { directionToPatch } from "@/lib/brand/build";
import { imageFileToBase64, pdfToBase64Pages, runPipeline, runStage } from "@/lib/brand/client";
import type { Finding } from "@/lib/brand/stages/types";
import type { Direction } from "@/lib/brand/stages/directions";

type Door = "analyse" | "build" | "refine";
type Step = "start" | "sources" | "reading" | "basics" | "audience" | "why" | "personality" | "directions" | "finishing";

const BUILD_STEPS: Step[] = ["basics", "audience", "why", "personality", "directions"];
const REFINE_STEPS: Step[] = ["sources", "audience", "why", "personality", "directions"];

interface Answers {
  offering: string;
  category: string;
  countries: string;
  cityTiers: CityTier[];
  languages: string[];
  gender: Gender[];
  ageGroups: AgeGroup[];
  affluence?: Affluence;
  motivations: Motivation[];
  moments: Moment[];
  competitors: string;
  personality: Record<string, "a" | "b" | undefined>;
}

const EMPTY_ANSWERS: Answers = {
  offering: "",
  category: "",
  countries: "India",
  cityTiers: [],
  languages: ["English"],
  gender: [],
  ageGroups: [],
  motivations: [],
  moments: [],
  competitors: "",
  personality: {},
};

export default function OnboardingPage() {
  const router = useRouter();
  const saveBrandModel = useStore((s) => s.saveBrandModel);

  const [step, setStep] = useState<Step>("start");
  const [door, setDoor] = useState<Door | null>(null);
  const [name, setName] = useState("");

  // Door A sources
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [igHandle, setIgHandle] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  // Running state
  const [findings, setFindings] = useState<Finding[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<BrandModel | null>(null);

  // Door B answers + directions
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [directions, setDirections] = useState<Direction[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [seed, setSeed] = useState(1);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const set = <K extends keyof Answers>(k: K, v: Answers[K]) => setAnswers((a) => ({ ...a, [k]: v }));

  const flow = door === "build" ? BUILD_STEPS : door === "refine" ? REFINE_STEPS : [];
  const stepNo = flow.indexOf(step) + 1 || undefined;

  // ── Dropzone (PDF or screenshots) ────────────────────────────────────────
  const onDrop = useCallback((accepted: File[]) => setFiles((f) => [...f, ...accepted].slice(0, 9)), []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"], "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
    maxFiles: 9,
  });

  // ── Door A: read sources ────────────────────────────────────────────────
  const readBrand = async () => {
    setError(null);
    setFindings([]);
    setRunning(true);
    setStep("reading");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      let images: string[] = [];
      let imageSource: "pdf" | "instagram" | "upload" = "upload";
      const pdf = files.find((f) => f.type === "application/pdf");
      const pics = files.filter((f) => f.type.startsWith("image/"));
      if (pdf) {
        setFindings([{ id: "prep", label: `Opening ${pdf.name}`, status: "info" }]);
        images = (await pdfToBase64Pages(pdf, 6)).images;
        imageSource = "pdf";
      }
      if (pics.length) {
        images = [...images, ...(await Promise.all(pics.slice(0, 8 - images.length).map((f) => imageFileToBase64(f))))];
        if (!pdf) imageSource = igHandle ? "instagram" : "upload";
      }
      const base = emptyModel(name.trim(), door === "refine" ? "refine" : "analyse");
      const result = await runPipeline(
        "analyse",
        base,
        { websiteUrl: websiteUrl.trim() || undefined, igHandle: igHandle.trim() || undefined, images, imageSource },
        setFindings,
        controller.signal
      );
      setFindings(result.findings);
      setModel(result.model);
      setRunning(false);
      if (door === "refine") {
        // Prefill the interview with what we found, then continue the Build path.
        const a = result.model.strategy.audience;
        setAnswers((prev) => ({
          ...prev,
          offering: result.model.strategy.offering,
          category: result.model.strategy.category,
          gender: a.gender ? [a.gender] : [],
          ageGroups: a.ageGroups,
          affluence: a.affluence,
          languages: a.languages.length ? a.languages : prev.languages,
          cityTiers: a.markets.cityTiers,
          motivations: a.motivations,
          moments: a.moments,
        }));
        setStep("audience");
      } else {
        saveBrandModel(result.model, {
          website: websiteUrl.trim() || undefined,
          instagram: igHandle.trim() || undefined,
          pdfName: pdf?.name,
        });
        router.push("/brand?welcome=1");
      }
    } catch (err) {
      setRunning(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // ── Door B: answers → model ─────────────────────────────────────────────
  const modelFromAnswers = useCallback((): BrandModel => {
    const base = model ?? emptyModel(name.trim(), door === "refine" ? "refine" : "build");
    const countries = answers.countries.split(",").map((c) => c.trim()).filter(Boolean);
    return mergePatch(
      base,
      {
        name: name.trim(),
        strategy: {
          offering: answers.offering,
          category: answers.category,
          competitors: answers.competitors.split(",").map((c) => c.trim()).filter(Boolean),
          audience: {
            gender: answers.gender[0],
            ageGroups: answers.ageGroups,
            affluence: answers.affluence,
            markets: { countries, cityTiers: answers.cityTiers },
            languages: answers.languages,
            motivations: answers.motivations,
            moments: answers.moments,
          },
        },
        personality: scorePersonality(answers.personality),
      },
      { source: "user", confidence: 1 }
    ).model;
  }, [answers, door, model, name]);

  const designDirections = async (nextSeed = seed) => {
    setError(null);
    setDirections(null);
    setPicked(null);
    setStep("directions");
    setRunning(true);
    try {
      const m = modelFromAnswers();
      const res = await runStage("directions", m, { seed: nextSeed });
      setDirections((res.output.directions as Direction[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setRunning(false);
  };

  const finishBuild = async () => {
    const d = directions?.find((x) => x.id === picked);
    if (!d) return;
    setError(null);
    setStep("finishing");
    setRunning(true);
    setFindings([]);
    try {
      const withAnswers = modelFromAnswers();
      const chosen = mergePatch(withAnswers, directionToPatch(d), { source: "user", confidence: 1 }).model;
      const result = await runPipeline("build", chosen, {}, setFindings);
      saveBrandModel(result.model, door === "refine" ? { website: websiteUrl.trim() || undefined, instagram: igHandle.trim() || undefined } : {});
      router.push("/brand?welcome=1");
    } catch (err) {
      setRunning(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const canRead = name.trim() && (websiteUrl.trim() || igHandle.trim() || files.length);
  const personalityAnswered = useMemo(() => Object.values(answers.personality).filter(Boolean).length, [answers.personality]);

  // ── Screens ──────────────────────────────────────────────────────────────
  return (
    <AppShell>
      {step === "start" && (
        <OnboardingShell
          title="Set up your brand"
          subtitle="Brandly learns your brand once, so every post it writes sounds and looks like you."
          primary={{
            label: "Continue",
            disabled: !name.trim() || !door,
            onClick: () => setStep(door === "build" ? "basics" : "sources"),
          }}
        >
          <Input label="Brand name" placeholder="e.g. Chai Point" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <div className="mt-8 space-y-3">
            <p className="text-sm font-medium">Where are you starting from?</p>
            <ChoiceCard
              icon={<Store size={20} strokeWidth={1.75} />}
              title="I have a website or Instagram"
              description="Brandly reads what you already have: colours, fonts, logo and how you write."
              selected={door === "analyse"}
              onClick={() => setDoor("analyse")}
            />
            <ChoiceCard
              icon={<Sprout size={20} strokeWidth={1.75} />}
              title="I'm starting from scratch"
              description="Answer a few quick questions and pick from three brand directions."
              selected={door === "build"}
              onClick={() => setDoor("build")}
            />
            <button
              onClick={() => setDoor("refine")}
              aria-pressed={door === "refine"}
              className={clsx(
                "text-sm underline-offset-4 hover:underline pt-1",
                door === "refine" ? "text-text font-medium" : "text-text-muted"
              )}
            >
              {door === "refine" && <Check size={14} className="inline mr-1 -mt-0.5" />}I have a website, but no real brand yet
            </button>
          </div>
        </OnboardingShell>
      )}

      {step === "sources" && (
        <OnboardingShell
          step={stepNo}
          total={flow.length || undefined}
          title={door === "refine" ? "Show us what you have" : "Where can we find your brand?"}
          subtitle="Add at least one. The more you add, the better the match."
          onBack={() => setStep("start")}
          primary={{ label: "Read my brand", onClick: readBrand, disabled: !canRead }}
        >
          <div className="space-y-5">
            <Input label="Website" placeholder="yourbrand.com" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} inputMode="url" />
            <Input label="Instagram handle" placeholder="yourbrand" prefix="@" value={igHandle} onChange={(e) => setIgHandle(e.target.value.replace(/^@/, ""))} />
            <div>
              <p className="text-sm font-medium mb-1.5">Catalogue PDF or post screenshots</p>
              <p className="text-xs text-text-muted mb-2">
                Instagram doesn&apos;t let apps read posts directly, so 4–6 screenshots of your grid help a lot.
              </p>
              <div
                {...getRootProps()}
                className={clsx(
                  "rounded-xl border border-dashed p-6 text-center cursor-pointer transition-colors",
                  isDragActive ? "border-text bg-text/[0.03]" : "border-border hover:border-text/30"
                )}
              >
                <input {...getInputProps()} />
                <FileUp size={20} className="mx-auto text-text-muted" />
                <p className="text-sm mt-2">Drop files here or click to choose</p>
                <p className="text-xs text-text-muted mt-0.5">PDF, PNG or JPG. Up to 9 files.</p>
              </div>
              {files.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm bg-card border border-border rounded-lg px-3 h-9">
                      <span className="truncate flex-1">{f.name}</span>
                      <span className="text-xs text-text-muted">{(f.size / 1024).toFixed(0)} KB</span>
                      <button onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} className="text-text-muted hover:text-text">
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </OnboardingShell>
      )}

      {step === "reading" && (
        <OnboardingShell
          title={running ? `Reading ${name}` : error ? "That didn't work" : "Done"}
          subtitle={running ? "This takes about 20–40 seconds. Here's what we've found so far." : undefined}
          onBack={running ? undefined : () => setStep("sources")}
          primary={error ? { label: "Try again", onClick: readBrand } : undefined}
        >
          <LiveFindings findings={findings} running={running} />
          {error && <p className="mt-4 text-sm text-error">{error}</p>}
        </OnboardingShell>
      )}

      {step === "basics" && (
        <OnboardingShell
          step={stepNo}
          total={flow.length}
          title="What do you sell, and where?"
          onBack={() => setStep("start")}
          primary={{ label: "Continue", onClick: () => setStep("audience"), disabled: !answers.offering.trim() }}
        >
          <Question title="What do you sell?" hint="Plain words are best. e.g. “Handmade soy candles and gift boxes”">
            <Textarea rows={2} value={answers.offering} onChange={(e) => set("offering", e.target.value)} placeholder="We sell…" />
          </Question>
          <Question title="Which country or countries?">
            <Input value={answers.countries} onChange={(e) => set("countries", e.target.value)} placeholder="India" />
          </Question>
          <Question title="Where are most customers?" hint="Pick all that apply">
            <ChipGroup
              multi
              options={(Object.keys(CITY_TIER_LABELS) as CityTier[]).map((v) => ({ value: v, label: CITY_TIER_LABELS[v] }))}
              value={answers.cityTiers}
              onChange={(v) => set("cityTiers", v)}
            />
          </Question>
          <Question title="Which language should posts be in?" hint="Pick all that apply">
            <ChipGroup multi options={LANGUAGE_OPTIONS.map((l) => ({ value: l, label: l }))} value={answers.languages} onChange={(v) => set("languages", v)} />
          </Question>
        </OnboardingShell>
      )}

      {step === "audience" && (
        <OnboardingShell
          step={stepNo}
          total={flow.length}
          title="Who buys from you?"
          subtitle={door === "refine" ? "We guessed from your website. Fix anything that's off." : "This shapes your colours, voice and where you post."}
          onBack={() => setStep(door === "build" ? "basics" : "sources")}
          primary={{ label: "Continue", onClick: () => setStep("why") }}
          secondary={{ label: "Not sure, let Brandly suggest", onClick: () => setStep("why") }}
        >
          <Question title="Mostly…">
            <ChipGroup options={GENDER_OPTIONS} value={answers.gender} onChange={(v) => set("gender", v)} />
          </Question>
          <Question title="Which age groups?" hint="Pick all that apply">
            <ChipGroup multi options={AGE_GROUPS.map((a) => ({ value: a, label: AGE_LABELS[a] }))} value={answers.ageGroups} onChange={(v) => set("ageGroups", v)} />
          </Question>
          <Question title="How do your customers spend?">
            <TierCards options={AFFLUENCE_OPTIONS} value={answers.affluence} onChange={(v) => set("affluence", v)} />
          </Question>
        </OnboardingShell>
      )}

      {step === "why" && (
        <OnboardingShell
          step={stepNo}
          total={flow.length}
          title="Why and when do people buy?"
          onBack={() => setStep("audience")}
          primary={{ label: "Continue", onClick: () => setStep("personality") }}
          secondary={{ label: "Not sure, let Brandly suggest", onClick: () => setStep("personality") }}
        >
          <Question title="Why do they buy from you?" hint="Pick up to 2">
            <ChipGroup multi max={2} options={MOTIVATIONS.map((m) => ({ value: m, label: MOTIVATION_LABELS[m] }))} value={answers.motivations} onChange={(v) => set("motivations", v)} />
          </Question>
          <Question title="When do they think of you?" hint="Pick all that apply">
            <ChipGroup multi options={MOMENTS.map((m) => ({ value: m, label: MOMENT_LABELS[m] }))} value={answers.moments} onChange={(v) => set("moments", v)} />
          </Question>
          <Question title="Brands you admire or compete with" hint="Optional. Separate with commas.">
            <Input value={answers.competitors} onChange={(e) => set("competitors", e.target.value)} placeholder="e.g. Chaayos, Blue Tokai" />
          </Question>
        </OnboardingShell>
      )}

      {step === "personality" && (
        <OnboardingShell
          step={stepNo}
          total={flow.length}
          title="Pick the one that's more you"
          subtitle="Go with your gut. Skip any that don't fit."
          onBack={() => setStep("why")}
          primary={{ label: "Show me directions", onClick: () => designDirections(), disabled: personalityAnswered < 3 }}
        >
          <div className="space-y-6">
            {THIS_OR_THAT.map((pair) => (
              <div key={pair.id}>
                <p className="text-sm font-medium mb-2">{pair.question}</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["a", "b"] as const).map((side) => {
                    const opt = pair[side];
                    const on = answers.personality[pair.id] === side;
                    return (
                      <button
                        key={side}
                        onClick={() => set("personality", { ...answers.personality, [pair.id]: on ? undefined : side })}
                        aria-pressed={on}
                        className={clsx(
                          "text-left rounded-xl border p-3.5 transition-colors bg-card",
                          on ? "border-text ring-1 ring-text" : "border-border hover:border-text/30"
                        )}
                      >
                        <span className="block text-sm font-medium">{opt.label}</span>
                        <span className="block text-xs text-text-muted mt-1">{opt.example}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {personalityAnswered < 3 && <p className="mt-6 text-xs text-text-muted">Answer at least 3 to continue.</p>}
        </OnboardingShell>
      )}

      {step === "directions" && (
        <OnboardingShell
          wide
          step={stepNo}
          total={flow.length}
          title="Pick a starting direction"
          subtitle="You can change colours, fonts and voice afterwards."
          onBack={() => setStep("personality")}
          primary={directions ? { label: "Use this direction", onClick: finishBuild, disabled: !picked } : undefined}
          secondary={
            directions
              ? {
                  label: "Show me three different ones",
                  onClick: () => {
                    setSeed((s) => s + 1);
                    designDirections(seed + 1);
                  },
                }
              : undefined
          }
        >
          {running && !directions && (
            <div className="grid gap-4 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-2xl border border-border bg-card p-4 space-y-3">
                  <div className="h-10 rounded-lg bg-text/5 animate-pulse" />
                  <div className="aspect-square rounded-xl bg-text/5 animate-pulse" />
                  <div className="h-4 w-2/3 rounded bg-text/5 animate-pulse" />
                </div>
              ))}
              <p className="sm:col-span-3 text-sm text-text-muted">Designing three directions. About 15 seconds.</p>
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-error/30 p-4 text-sm">
              <p className="text-error">{error}</p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => designDirections()}>
                <RefreshCw size={14} /> Try again
              </Button>
            </div>
          )}
          {directions && (
            <div className="grid gap-4 sm:grid-cols-3">
              {directions.map((d, i) => (
                <button
                  key={d.id}
                  onClick={() => setPicked(d.id)}
                  aria-pressed={picked === d.id}
                  className={clsx(
                    "text-left rounded-2xl border bg-card p-4 transition-colors flex flex-col gap-3",
                    picked === d.id ? "border-text ring-1 ring-text" : "border-border hover:border-text/30"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{d.name}</p>
                      <p className="text-xs text-text-muted mt-0.5">{d.words.join(" · ")}</p>
                    </div>
                    <span className={clsx("w-5 h-5 rounded-full border grid place-items-center shrink-0", picked === d.id ? "bg-text border-text text-bg" : "border-border")}>
                      {picked === d.id && <Check size={12} strokeWidth={3} />}
                    </span>
                  </div>
                  <PaletteStrip palette={d.palette} />
                  <BrandPostPreview name={name} headline={d.oneLiner || name} caption={d.sampleCaption} palette={d.palette} fonts={d.fonts} variant={i} />
                  <p className="text-xs text-text-muted">
                    {d.fonts.heading} + {d.fonts.body}
                  </p>
                  <ul className="space-y-1.5">
                    {d.sampleLines.map((l, j) => (
                      <li key={j} className="text-sm leading-snug">
                        “{l}”
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
          )}
        </OnboardingShell>
      )}

      {step === "finishing" && (
        <OnboardingShell title="Setting up your brand" subtitle="Planning what to post about and checking your colours." onBack={error ? () => setStep("directions") : undefined}>
          <LiveFindings findings={findings} running={running} />
          {error && <p className="mt-4 text-sm text-error">{error}</p>}
        </OnboardingShell>
      )}
    </AppShell>
  );
}
