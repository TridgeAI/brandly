"use client";
import { useState } from "react";
import { Button, Input } from "@/components/ui";
import AuthCard, { authMessage } from "@/components/auth/AuthCard";
import { createClient } from "@/lib/supabase/client";

// Reached from the password-reset email (the callback route has already signed the user in).
export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError("Choose a password with at least 8 characters.");
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.updateUser({ password });
    if (error) {
      setBusy(false);
      return setError(/session/i.test(error.message) ? "This reset link has expired. Request a new one." : authMessage(error));
    }
    window.location.href = "/";
  };

  return (
    <AuthCard title="Choose a new password">
      <form onSubmit={submit} className="space-y-4">
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-error">{error}</p>}
        <Button type="submit" className="w-full" loading={busy}>
          Save password
        </Button>
      </form>
    </AuthCard>
  );
}
