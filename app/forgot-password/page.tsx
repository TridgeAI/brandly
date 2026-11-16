"use client";
import Link from "next/link";
import { useState } from "react";
import { Button, Input } from "@/components/ui";
import AuthCard, { authMessage } from "@/components/auth/AuthCard";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
    });
    setBusy(false);
    if (error) return setError(authMessage(error));
    setSent(true);
  };

  return (
    <AuthCard
      title="Reset your password"
      subtitle={sent ? undefined : "We'll email you a link to choose a new one."}
      footer={
        <Link href="/login" className="text-text underline underline-offset-2">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <p className="text-sm">If an account exists for {email}, a reset link is on its way.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && <p className="text-sm text-error">{error}</p>}
          <Button type="submit" className="w-full" loading={busy}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
