import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/");

// Email links (confirm signup, magic link, password reset) land here with ?code=… (PKCE).
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const next = safeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    console.warn("[auth/callback]", error.message);
  }
  const to = new URL("/login", url.origin);
  to.searchParams.set("error", "link");
  return NextResponse.redirect(to);
}
