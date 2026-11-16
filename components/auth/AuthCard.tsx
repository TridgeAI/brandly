import Link from "next/link";

/** Plain, centred card shared by the sign-in pages. */
export default function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="flex items-center gap-2 mb-8">
        <span className="w-7 h-7 rounded-md bg-text text-bg grid place-items-center text-sm font-bold">B</span>
        <span className="text-base font-semibold tracking-tight">Brandly</span>
      </Link>
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-card">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-text-muted mt-1">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="mt-5 text-sm text-text-muted text-center">{footer}</div>}
    </main>
  );
}

/** Where to go after signing in: ?next=/path (same-site paths only). */
export function nextPath(): string {
  if (typeof window === "undefined") return "/";
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

/** Supabase error messages, reworded for people. */
export function authMessage(err: { message?: string; code?: string } | null | undefined): string {
  const m = err?.message ?? "Something went wrong. Please try again.";
  if (/invalid login credentials/i.test(m)) return "That email and password don't match.";
  if (/email not confirmed/i.test(m)) return "Please confirm your email first. Check your inbox for the link.";
  if (/already registered|already exists/i.test(m)) return "There's already an account with this email. Sign in instead.";
  if (/rate limit|too many/i.test(m)) return "Too many attempts. Wait a minute and try again.";
  if (/password should be|weak password/i.test(m)) return "Choose a longer password (at least 8 characters).";
  if (/token has expired|invalid/i.test(m) && /otp|token/i.test(m)) return "That code is wrong or has expired.";
  return m;
}
