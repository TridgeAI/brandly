import { NextResponse } from "next/server";

// Brandly's /api/* routes forward to the n8n "Brandly Backend" workflow when
// N8N_WEBHOOK_BASE_URL is set (e.g. http://localhost:5678/webhook).
// Each route maps to the webhook path `brandly-<route>`.

export type N8nRoute =
  | "analyse-brand"
  | "analyse-pdf"
  | "generate-post"
  | "automation"
  | "generate-image"
  | "publish";

export function n8nEnabled(): boolean {
  return Boolean(process.env.N8N_WEBHOOK_BASE_URL);
}

export async function callN8n(route: N8nRoute, body: unknown): Promise<NextResponse> {
  const base = process.env.N8N_WEBHOOK_BASE_URL?.replace(/\/+$/, "");
  if (!base) {
    return NextResponse.json(
      { error: "n8n backend is not configured (set N8N_WEBHOOK_BASE_URL)" },
      { status: 503 }
    );
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.N8N_WEBHOOK_SECRET) {
    headers["X-Brandly-Secret"] = process.env.N8N_WEBHOOK_SECRET;
  }

  try {
    const res = await fetch(`${base}/brandly-${route}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(240_000),
    });

    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text || `n8n responded with HTTP ${res.status}` };
    }
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error(`[n8n:${route}]`, err);
    return NextResponse.json({ error: "Could not reach the n8n backend" }, { status: 502 });
  }
}
