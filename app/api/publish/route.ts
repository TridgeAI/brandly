import { NextRequest } from "next/server";
import { callN8n } from "@/lib/n8n";

// Publishing only exists in the n8n backend (Ayrshare), so there is no local fallback.
export async function POST(req: NextRequest) {
  const body = await req.json();
  return callN8n("publish", body);
}
