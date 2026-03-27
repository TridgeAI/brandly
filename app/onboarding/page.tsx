"use client";
import { useState, useRef, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import AppShell from "@/components/layout/AppShell";
import { useStore } from "@/lib/store";
import { Button, Input, Card, Chip, SectionLabel, PageHeader } from "@/components/ui";
import type { Brand, BrandDNA } from "@/lib/types";

type Step = "brands" | "sources" | "analysing" | "styleguide" | "sample";

const STEPS: Step[] = ["brands", "sources", "analysing", "styleguide", "sample"];
const STEP_LABELS: Record<Step, string> = {
  brands: "Brands",
  sources: "Sources",
  analysing: "Analysing",
  styleguide: "Style Guide",
  sample: "Sample Post",
};

interface LogEntry { msg: string; type: "info" | "success" | "error" | "accent" | "warn"; }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Browser-side PDF → base64 JPEG pages using PDF.js
async function pdfToBase64Pages(
  file: File,
  maxPages = 8,
  onProgress?: (msg: string) => void
): Promise<{ images: string[]; totalPages: number }> {
  if (!window.pdfjsLib) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load PDF.js"));
      document.head.appendChild(s);
    });
  }
  (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const ab = await file.arrayBuffer();
  const pdf = await (window as any).pdfjsLib.getDocument({ data: ab }).promise;
  const totalPages: number = pdf.numPages;
  const pagesToRender = Math.min(totalPages, maxPages);
  const images: string[] = [];

  for (let i = 1; i <= pagesToRender; i++) {
    onProgress?.(`Rendering page ${i} of ${pagesToRender}…`);
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.8 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    images.push(canvas.toDataURL("image/jpeg", 0.88).split(",")[1]);
  }
  return { images, totalPages };
}

export default function OnboardingPage() {
  const { brands, addBrand, updateBrand, getActiveBrand } = useStore();
  const [step, setStep] = useState<Step>("brands");
  const [newBrandName, setNewBrandName] = useState("");
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [igHandle, setIgHandle] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfMeta, setPdfMeta] = useState<{ name: string; size: string; totalPages: number | string } | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [dna, setDna] = useState<BrandDNA | null>(null);
  const [samplePost, setSamplePost] = useState<any>(null);
  const [loadingSample, setLoadingSample] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string, type: LogEntry["type"] = "info") => {
    setLog((l) => [...l, { msg, type }]);
    setTimeout(() => {
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, 50);
  };

  // Dropzone
  const onDrop = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setPdfFile(f);
    setPdfMeta({ name: f.name, size: (f.size / 1024).toFixed(0), totalPages: "…" });
    try {
      if (!window.pdfjsLib) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
          s.onload = () => resolve();
          s.onerror = () => reject();
          document.head.appendChild(s);
        });
      }
      (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      const ab = await f.arrayBuffer();
      const pdf = await (window as any).pdfjsLib.getDocument({ data: ab }).promise;
      setPdfMeta({ name: f.name, size: (f.size / 1024).toFixed(0), totalPages: pdf.numPages });
    } catch {
      setPdfMeta((m) => m ? { ...m, totalPages: "?" } : null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
  });

  // ── Analysis pipeline ──────────────────────────────────────────────────
  const runAnalysis = async () => {
    setAnalysing(true);
    setLog([]);
    setStep("analysing");
    const brandName = newBrandName.trim();
    let pdfInsights: Record<string, unknown> | null = null;

    addLog("Initialising Brand Intelligence Engine…");
    await sleep(400);

    // PDF path: rasterise → Claude Vision via API
    if (pdfFile) {
      addLog(`📄 PDF detected: "${pdfMeta?.name}" (${pdfMeta?.totalPages} pages)`);
      await sleep(300);
      addLog("Rasterising pages — capturing raster + vector + layered content…");
      try {
        const { images, totalPages } = await pdfToBase64Pages(pdfFile, 8, (msg) => addLog(msg));
        addLog(`✓ ${images.length}/${totalPages} pages rendered. Sending to Claude Vision…`, "accent");
        const res = await fetch("/api/analyse-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pages: images, brandName }),
        });
        const data = await res.json();
        pdfInsights = data.insights ?? null;
        if (pdfInsights) addLog(`✓ PDF visual analysis complete`, "success");
        else addLog("PDF analysis returned unexpected format — continuing", "warn");
      } catch (err: any) {
        addLog(`PDF error: ${err.message}`, "error");
      }
      await sleep(300);
    }

    if (websiteUrl) {
      addLog(`🌐 Crawling website: ${websiteUrl}`);
      await sleep(600);
      addLog("Extracting colours, imagery & copy…");
      await sleep(500);
    }
    if (igHandle) {
      addLog(`📸 Analysing Instagram: @${igHandle}`);
      await sleep(600);
      addLog("Sampling posts, captions & hashtag patterns…");
      await sleep(400);
    }

    addLog("Synthesising all sources into Brand DNA…", "accent");

    const res = await fetch("/api/analyse-brand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandName, websiteUrl, igHandle, pdfInsights }),
    });
    const data = await res.json();

    if (data.dna) {
      addLog("Brand DNA profile built ✓", "success");
      setDna(data.dna);
      await sleep(400);
      setStep("styleguide");
    } else {
      addLog("Error building Brand DNA — please retry.", "error");
    }
    setAnalysing(false);
  };

  // ── Sample post ────────────────────────────────────────────────────────
  const generateSample = async () => {
    if (!dna) return;
    setLoadingSample(true);
    setSamplePost(null);
    const res = await fetch("/api/generate-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandDNA: dna,
        template: "product_launch",
        platforms: ["instagram"],
        topic: "brand introduction",
      }),
    });
    const data = await res.json();
    setSamplePost(data.post ?? null);
    setLoadingSample(false);
  };

  // ── Save brand ─────────────────────────────────────────────────────────
  const saveBrand = () => {
    if (!dna) return;
    const brand: Brand = {
      id: editingBrandId ?? `brand_${Date.now()}`,
      name: dna.brandName,
      dna,
      sources: {
        website: websiteUrl || undefined,
        instagram: igHandle || undefined,
        pdfName: pdfMeta?.name,
        pdfPages: typeof pdfMeta?.totalPages === "number" ? pdfMeta.totalPages : undefined,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (editingBrandId) updateBrand(editingBrandId, brand);
    else addBrand(brand);
    setStep("brands");
    setNewBrandName("");
    setWebsiteUrl("");
    setIgHandle("");
    setPdfFile(null);
    setPdfMeta(null);
    setDna(null);
    setSamplePost(null);
  };

  const startNew = () => {
    setNewBrandName("");
    setWebsiteUrl("");
    setIgHandle("");
    setPdfFile(null);
    setPdfMeta(null);
    setDna(null);
    setSamplePost(null);
    setEditingBrandId(null);
    setStep("sources");
  };

  const canAnalyse = (websiteUrl.trim() || igHandle.trim() || pdfFile) && newBrandName.trim();

  const stepIndex = STEPS.indexOf(step);

  return (
    <AppShell>
      <div className="p-8 max-w-4xl mx-auto">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-10">
          {STEPS.filter((s) => s !== "analysing").map((s, i) => {
            const visibleSteps = STEPS.filter((x) => x !== "analysing");
            const isActive = step === s || (step === "analysing" && s === "sources");
            const isDone =
              visibleSteps.indexOf(s) <
              visibleSteps.indexOf(
                step === "analysing" ? "styleguide" : step
              );
            return (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                    isDone
                      ? "bg-success text-white"
                      : isActive
                      ? "bg-accent text-white"
                      : "bg-border text-text-muted"
                  }`}
                >
                  {isDone ? "✓" : i + 1}
                </div>
                <span
                  className={`text-xs font-medium ${
                    isActive ? "text-text" : isDone ? "text-success" : "text-text-muted"
                  }`}
                >
                  {STEP_LABELS[s]}
                </span>
                {i < visibleSteps.length - 1 && (
                  <div className="w-8 h-px bg-border mx-1" />
                )}
              </div>
            );
          })}
        </div>

        {/* ── BRANDS ── */}
        {step === "brands" && (
          <div className="animate-fade-up">
            <PageHeader
              title="Brand Intelligence"
              subtitle="Build a Brand DNA profile from your website, Instagram, and product catalogues."
            />
            <div className="grid grid-cols-3 gap-4">
              {brands.map((b) => (
                <Card
                  key={b.id}
                  hover
                  className="p-5"
                  onClick={() => {
                    setEditingBrandId(b.id);
                    setNewBrandName(b.name);
                    setWebsiteUrl(b.sources.website ?? "");
                    setIgHandle(b.sources.instagram ?? "");
                    setDna(b.dna);
                    setStep("styleguide");
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl mb-3"
                    style={{
                      background: `linear-gradient(135deg, ${b.dna.colors.primary}, ${b.dna.colors.secondary})`,
                    }}
                  />
                  <p className="font-semibold mb-1 truncate">{b.name}</p>
                  <p className="text-xs text-text-muted mb-3 truncate">{b.dna.vibe.slice(0, 2).join(" · ")}</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {b.sources.website && <Chip variant="neutral" className="text-[10px]">🌐 Web</Chip>}
                    {b.sources.instagram && <Chip variant="neutral" className="text-[10px]">📸 IG</Chip>}
                    {b.sources.pdfName && <Chip variant="neutral" className="text-[10px]">📄 PDF</Chip>}
                  </div>
                </Card>
              ))}
              <Card className="p-5 border-dashed">
                <SectionLabel>New Brand</SectionLabel>
                <Input
                  placeholder="Brand name…"
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  className="mb-3"
                />
                <Button
                  className="w-full"
                  disabled={!newBrandName.trim()}
                  onClick={() => setStep("sources")}
                >
                  + Create
                </Button>
              </Card>
            </div>
          </div>
        )}

        {/* ── SOURCES ── */}
        {step === "sources" && (
          <div className="animate-fade-up">
            <button
              onClick={() => setStep("brands")}
              className="text-sm text-text-muted hover:text-text mb-6 flex items-center gap-1"
            >
              ← Back
            </button>
            <PageHeader
              title={`Sources for ${newBrandName}`}
              subtitle="Provide any combination — more sources means richer Brand DNA."
            />

            <div className="space-y-4">
              {/* Website */}
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-blue-900/40 flex items-center justify-center text-xl">🌐</div>
                  <div>
                    <p className="font-semibold text-sm">Website</p>
                    <p className="text-xs text-text-muted">Homepage, about, product & service pages</p>
                  </div>
                </div>
                <Input placeholder="https://yourbrand.com" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
              </Card>

              {/* Instagram */}
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-purple-900/40 flex items-center justify-center text-xl">📸</div>
                  <div>
                    <p className="font-semibold text-sm">Instagram</p>
                    <p className="text-xs text-text-muted">Recent posts, captions, visual style & hashtags</p>
                  </div>
                </div>
                <Input placeholder="yourhandle" prefix="@" value={igHandle} onChange={(e) => setIgHandle(e.target.value)} />
              </Card>

              {/* PDF */}
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-emerald-900/40 flex items-center justify-center text-xl">📄</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">PDF Catalogue</p>
                      <Chip variant="success" className="text-[10px]">NEW</Chip>
                    </div>
                    <p className="text-xs text-text-muted">Raster images + vector layers both extracted</p>
                  </div>
                </div>

                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    isDragActive ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"
                  }`}
                >
                  <input {...getInputProps()} />
                  <div className="text-3xl mb-2">📂</div>
                  <p className="font-medium text-sm mb-1">Drop PDF here or click to browse</p>
                  <p className="text-xs text-text-muted">Up to 8 pages · Raster + vector layers captured</p>
                </div>

                {pdfMeta && (
                  <div className="flex items-center gap-3 mt-3 p-3 bg-success/5 border border-success/20 rounded-xl">
                    <span className="text-xl">📄</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-success truncate">{pdfMeta.name}</p>
                      <p className="text-xs text-text-muted">{pdfMeta.totalPages} pages · {pdfMeta.size} KB</p>
                    </div>
                    <button onClick={() => { setPdfFile(null); setPdfMeta(null); }} className="text-text-muted hover:text-error text-xl leading-none">×</button>
                  </div>
                )}

                <div className="mt-4 p-4 bg-surface rounded-xl space-y-2">
                  <SectionLabel>What gets extracted</SectionLabel>
                  {[
                    ["🖼️", "Raster images", "Embedded photos & JPEGs"],
                    ["🎨", "Vector layers", "Shapes, illustrations & layered design (via page rasterisation)"],
                    ["🔤", "Typography", "Font styles, weights & hierarchy"],
                    ["🎯", "Colour palette", "Exact hex colours from all visual elements"],
                    ["📐", "Layout & motifs", "Grid patterns & recurring brand signatures"],
                  ].map(([icon, label, desc]) => (
                    <div key={label as string} className="flex gap-2 text-xs">
                      <span className="shrink-0">{icon}</span>
                      <span>
                        <span className="font-semibold text-text">{label as string}</span>
                        <span className="text-text-muted"> — {desc as string}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Skip */}
              <Card className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Skip & provide context manually</p>
                  <p className="text-xs text-text-muted">Describe your brand yourself</p>
                </div>
                <Button variant="ghost" size="sm">Manual →</Button>
              </Card>
            </div>

            <div className="flex justify-end items-center gap-3 mt-6">
              {!canAnalyse && <span className="text-xs text-text-muted">Add a brand name and at least one source</span>}
              <Button disabled={!canAnalyse} onClick={runAnalysis}>Analyse Brand →</Button>
            </div>
          </div>
        )}

        {/* ── ANALYSING ── */}
        {step === "analysing" && (
          <div className="animate-fade-up flex flex-col items-center pt-12">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-accent-light flex items-center justify-center text-3xl mb-6 animate-spin-slow">
              ✦
            </div>
            <h2 className="font-display text-3xl font-bold mb-2">Analysing Your Brand</h2>
            <p className="text-text-muted mb-8">
              {pdfFile ? "PDF pages being rendered via Claude Vision — ~20–35s" : "Synthesising your sources…"}
            </p>
            <div
              ref={logRef}
              className="w-full max-w-xl bg-surface border border-border rounded-xl p-5 max-h-80 overflow-y-auto space-y-2.5"
            >
              {log.map((l, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm animate-fade-up">
                  <span className={
                    l.type === "success" ? "text-success" :
                    l.type === "error" ? "text-error" :
                    l.type === "warn" ? "text-warn" :
                    l.type === "accent" ? "text-accent-light" : "text-text-muted"
                  }>
                    {l.type === "success" ? "✓" : l.type === "error" ? "✗" : l.type === "accent" ? "✦" : "·"}
                  </span>
                  <span className={
                    l.type === "success" ? "text-success" :
                    l.type === "error" ? "text-error" :
                    l.type === "accent" ? "text-accent-light" : "text-text"
                  }>{l.msg}</span>
                  {i === log.length - 1 && analysing && (
                    <span className="ml-auto w-2 h-2 rounded-full bg-accent animate-pulse-dot" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── STYLE GUIDE ── */}
        {step === "styleguide" && dna && (
          <div className="animate-fade-up">
            <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
              <div>
                <Chip variant="success" className="mb-2">✓ Brand DNA Built</Chip>
                <h1 className="font-display text-3xl font-bold">{dna.brandName}</h1>
                <p className="text-text-muted mt-1.5 text-sm max-w-lg">{dna.one_liner}</p>
              </div>
              <Button onClick={() => { generateSample(); setStep("sample"); }}>
                Validate with Sample Post →
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Colours */}
              <Card className="p-5 col-span-2">
                <SectionLabel>Colour Palette</SectionLabel>
                <div className="flex gap-4 flex-wrap">
                  {Object.entries(dna.colors).map(([name, hex]) => (
                    <div key={name} className="flex flex-col items-center gap-2">
                      <div
                        className="w-14 h-14 rounded-xl border-2 border-border"
                        style={{ background: hex, boxShadow: `0 4px 20px ${hex}60` }}
                      />
                      <span className="text-[11px] text-text-muted capitalize">{name}</span>
                      <span className="text-[11px] font-semibold">{hex}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Vibe */}
              <Card className="p-5">
                <SectionLabel>Brand Vibe</SectionLabel>
                <div className="flex flex-wrap gap-2 mb-4">
                  {dna.vibe.map((v) => <Chip key={v} variant="accent">{v}</Chip>)}
                </div>
                <p className="text-xs text-text-muted mb-1">Visual Style</p>
                <p className="text-sm mb-3">{dna.visual_style}</p>
                <p className="text-xs text-text-muted mb-1">Typography Feel</p>
                <p className="text-sm">{dna.typography_feel}</p>
              </Card>

              {/* Audience */}
              <Card className="p-5">
                <SectionLabel>Audience & Tone</SectionLabel>
                <p className="text-xs text-text-muted mb-1">Target Audience</p>
                <p className="text-sm mb-4">{dna.target_audience}</p>
                <p className="text-xs text-text-muted mb-1">Communication Tone</p>
                <p className="text-sm">{dna.communication_tone}</p>
              </Card>

              {/* Products */}
              <Card className="p-5">
                <SectionLabel>Products & Services</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {dna.products_services.map((p) => <Chip key={p} variant="neutral">{p}</Chip>)}
                </div>
              </Card>

              {/* Themes */}
              <Card className="p-5">
                <SectionLabel>Content Themes</SectionLabel>
                <div className="space-y-2">
                  {dna.content_themes.map((t, i) => (
                    <div key={t} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-md bg-accent/10 text-accent-light text-[10px] font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </div>
                      <span className="text-sm">{t}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Hashtags */}
              <Card className="p-5">
                <SectionLabel>Hashtag Clusters</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {dna.hashtag_clusters.map((h) => (
                    <Chip key={h} variant="neutral" className="text-[11px]">{h}</Chip>
                  ))}
                </div>
              </Card>

              {/* Guidelines */}
              <Card className="p-5 col-span-2">
                <SectionLabel>Brand Guidelines</SectionLabel>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-semibold text-success mb-3">✓ Always Do</p>
                    {dna.do.map((d) => (
                      <div key={d} className="flex gap-2 text-sm py-2 border-b border-border last:border-0">
                        <span className="text-success shrink-0">→</span>{d}
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-error mb-3">✗ Never Do</p>
                    {dna.dont.map((d) => (
                      <div key={d} className="flex gap-2 text-sm py-2 border-b border-border last:border-0">
                        <span className="text-error shrink-0">✗</span>{d}
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="ghost" onClick={() => setStep("sources")}>Re-analyse</Button>
              <Button onClick={saveBrand}>Save Brand ✓</Button>
              <Button onClick={() => { generateSample(); setStep("sample"); }}>
                Validate with Sample Post →
              </Button>
            </div>
          </div>
        )}

        {/* ── SAMPLE POST ── */}
        {step === "sample" && (
          <div className="animate-fade-up">
            <button onClick={() => setStep("styleguide")} className="text-sm text-text-muted hover:text-text mb-6 flex items-center gap-1">
              ← Back to Style Guide
            </button>
            <PageHeader title="Sample Post" subtitle="Generated using your Brand DNA. Does this feel right?" />

            {loadingSample && (
              <div className="flex flex-col items-center py-20 gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-accent-light flex items-center justify-center text-xl animate-spin-slow">✦</div>
                <p className="text-text-muted">Generating on-brand content…</p>
              </div>
            )}

            {samplePost && !loadingSample && (
              <div className="grid grid-cols-2 gap-6">
                {/* Preview */}
                <Card className="overflow-hidden">
                  <div className="p-4 border-b border-border flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full"
                      style={{
                        background: `linear-gradient(135deg, ${dna?.colors.primary}, ${dna?.colors.secondary})`,
                      }}
                    />
                    <div>
                      <p className="text-sm font-semibold">@{igHandle || "yourbrand"}</p>
                      <p className="text-xs text-text-muted">Instagram · {samplePost.postType}</p>
                    </div>
                  </div>
                  <div
                    className="aspect-square flex flex-col items-center justify-center p-6 text-center border-b border-border"
                    style={{
                      background: `linear-gradient(135deg, ${dna?.colors.primary}22, ${dna?.colors.secondary}22)`,
                    }}
                  >
                    <div className="text-3xl mb-3">🎨</div>
                    <p className="text-xs font-semibold text-accent-light mb-2">AI Image Generation Prompt:</p>
                    <p className="text-xs text-text-muted leading-relaxed">{samplePost.imagePrompt}</p>
                  </div>
                  <div className="p-4">
                    <p className="text-sm leading-relaxed whitespace-pre-line mb-3">{samplePost.caption}</p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {samplePost.hashtags?.map((h: string) => (
                        <span key={h} className="text-xs text-accent-light">{h}</span>
                      ))}
                    </div>
                    {samplePost.cta && (
                      <div className="p-3 bg-accent/10 rounded-lg text-xs text-accent-light font-medium">
                        CTA: {samplePost.cta}
                      </div>
                    )}
                    {samplePost.bestTimeToPost && (
                      <p className="text-xs text-text-muted mt-2">⏰ Best time: {samplePost.bestTimeToPost}</p>
                    )}
                  </div>
                </Card>

                {/* Actions */}
                <div className="space-y-4">
                  <Card className="p-5 border-success/20">
                    <div className="flex items-center gap-2 mb-2">
                      <span>✅</span>
                      <span className="font-semibold text-success">Brand DNA Validated</span>
                    </div>
                    <p className="text-sm text-text-muted leading-relaxed">
                      If this feels on-brand, save and start creating. If not, refine your style guide or add more sources.
                    </p>
                  </Card>

                  {dna && (
                    <Card className="p-5">
                      <SectionLabel>DNA Applied</SectionLabel>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {dna.vibe.map((v) => <Chip key={v} variant="accent" className="text-[11px]">{v}</Chip>)}
                      </div>
                      <p className="text-xs text-text-muted">Tone: {dna.communication_tone}</p>
                    </Card>
                  )}

                  <div className="space-y-2">
                    <Button className="w-full" onClick={saveBrand}>✦ Save Brand & Start Creating</Button>
                    <Button variant="ghost" className="w-full" onClick={generateSample}>↺ Regenerate Sample</Button>
                    <Button variant="ghost" className="w-full" onClick={() => setStep("styleguide")}>← Edit Style Guide</Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
