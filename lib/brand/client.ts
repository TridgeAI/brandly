"use client";
import type { BrandModel } from "./model";
import type { Finding } from "./stages/types";
import type { RunResult, PipelineId } from "./pipelines";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Starts a pipeline job and polls it, streaming findings to the UI. */
export async function runPipeline(
  pipeline: PipelineId,
  model: BrandModel,
  input: Record<string, unknown>,
  onFindings: (f: Finding[]) => void,
  signal?: AbortSignal
): Promise<RunResult> {
  const start = await fetch(`/api/brands/${encodeURIComponent(model.id)}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pipeline, model, input }),
    signal,
  });
  const { jobId, error } = await start.json().catch(() => ({ error: `HTTP ${start.status}` }));
  if (!jobId) throw new Error(error ?? "Couldn't start");

  for (;;) {
    if (signal?.aborted) throw new Error("Cancelled");
    await sleep(700);
    const res = await fetch(`/api/jobs/${jobId}`, { signal, cache: "no-store" });
    const job = await res.json();
    if (job.findings) onFindings(job.findings);
    if (job.status === "done") return job.result as RunResult;
    if (job.status === "error" || !res.ok) throw new Error(job.error ?? "Something went wrong");
  }
}

export async function runStage(stageId: string, model: BrandModel, input: Record<string, unknown> = {}): Promise<RunResult> {
  const res = await fetch(`/api/brands/${encodeURIComponent(model.id)}/stages/${stageId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, input }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as RunResult;
}

/** Loads Google Fonts on demand so brand previews render in the brand's own fonts. */
export function loadGoogleFonts(families: string[]) {
  if (typeof document === "undefined") return;
  const wanted = [...new Set(families.filter(Boolean))];
  const missing = wanted.filter((f) => !document.querySelector(`link[data-font="${CSS.escape(f)}"]`));
  for (const f of missing) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.dataset.font = f;
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;600;700&display=swap`;
    document.head.appendChild(link);
  }
}

/** Resizes an image file to a JPEG (base64, no prefix) for vision analysis. */
export async function imageFileToBase64(file: File, maxSide = 1280): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error(`Couldn't read ${file.name}`));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
  } finally {
    URL.revokeObjectURL(url);
  }
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdfjsLib?: any;
  }
}

/** Rasterises PDF pages in the browser (captures raster + vector content). */
export async function pdfToBase64Pages(file: File, maxPages = 8): Promise<{ images: string[]; totalPages: number }> {
  if (!window.pdfjsLib) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Couldn't load the PDF reader"));
      document.head.appendChild(s);
    });
  }
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const totalPages: number = pdf.numPages;
  const images: string[] = [];
  for (let i = 1; i <= Math.min(totalPages, maxPages); i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    images.push(canvas.toDataURL("image/jpeg", 0.85).split(",")[1]);
  }
  return { images, totalPages };
}
