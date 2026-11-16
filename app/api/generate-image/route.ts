import { NextRequest } from "next/server";
import { callN8n } from "@/lib/n8n";

// Image generation runs in the n8n backend (Alibaba Model Studio / Qwen-Image).
// Body: { prompt, aspect?: "1:1" | "4:5" | "4:3" | "16:9" | "9:16", brandDNA?, negativePrompt? }
// Response: { imageUrl, expiresAt, model, aspect, size } or { error }
export async function POST(req: NextRequest) {
  const body = await req.json();
  return callN8n("generate-image", body);
}
