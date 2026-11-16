import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/");

// For email templates that link with ?token_hash=…&type=… (works across devices, unlike PKCE codes).
// Template link: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(url.searchParams.get("next") ?? (type === "recovery" ? "/auth/update-password" : "/"));
  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    console.warn("[auth/confirm]", error.message);
  }
  const to = new URL("/login", url.origin);
  to.searchParams.set("error", "link");
  return NextResponse.redirect(to);
}
