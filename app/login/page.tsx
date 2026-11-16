"use client";
import Link from "next/link";
import { useState } from "react";
import { Button, Input } from "@/components/ui";
import AuthCard, { authMessage, nextPath } from "@/components/auth/AuthCard";
import { createClient } from "@/lib/supabase/client";

type Mode = "password" | "link";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = () => {
    window.location.href = nextPath();
  };

  const signInWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError(authMessage(error));
      setBusy(false);
      return;
    }
    done();
  };

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath())}`,
      },
    });
    setBusy(false);
    if (error) {
      setError(/signups not allowed|not found/i.test(error.message) ? "No account with that email yet. Create one below." : authMessage(error));
      return;
    }
    setSent(true);
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    if (error) {
      setError(authMessage(error));
      setBusy(false);
      return;
    }
    done();
  };

  return (
    <AuthCard
      title="Sign in"
      subtitle="Welcome back to Brandly."
      footer={
        <>
          New here?{" "}
          <Link href="/signup" className="text-text underline underline-offset-2">
            Create an account
          </Link>
        </>
      }
    >
      {mode === "password" ? (
        <form onSubmit={signInWithPassword} className="space-y-4">
          <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <div>
            <Input label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            <Link href="/forgot-password" className="inline-block mt-1.5 text-xs text-text-muted hover:text-text">
              Forgot password?
            </Link>
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <Button type="submit" className="w-full" loading={busy}>
            Sign in
          </Button>
        </form>
      ) : sent ? (
        <form onSubmit={verifyCode} className="space-y-4">
          <p className="text-sm">
            We sent a sign-in link to <strong>{email}</strong>. Open it on this device, or enter the code from the email.
          </p>
          <Input label="Code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
          {error && <p className="text-sm text-error">{error}</p>}
          <Button type="submit" className="w-full" loading={busy} disabled={code.trim().length < 6}>
            Verify code
          </Button>
          <button type="button" className="text-xs text-text-muted hover:text-text" onClick={() => setSent(false)}>
            Use a different email
          </button>
        </form>
      ) : (
        <form onSubmit={sendLink} className="space-y-4">
          <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && <p className="text-sm text-error">{error}</p>}
          <Button type="submit" className="w-full" loading={busy}>
            Email me a sign-in link
          </Button>
        </form>
      )}

      <div className="mt-5 pt-4 border-t border-border text-center">
        <button
          type="button"
          className="text-sm text-text-muted hover:text-text"
          onClick={() => {
            setMode(mode === "password" ? "link" : "password");
            setError(null);
            setSent(false);
          }}
        >
          {mode === "password" ? "Sign in with an email link instead" : "Sign in with a password instead"}
        </button>
      </div>
    </AuthCard>
  );
}
