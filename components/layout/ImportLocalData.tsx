"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { useStore } from "@/lib/store";

const LEGACY_KEY = "brandly-store";

interface LegacyState {
  brands?: unknown[];
  posts?: unknown[];
  automationRules?: unknown[];
}

function readLegacy(): LegacyState | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const state = (JSON.parse(raw) as { state?: LegacyState }).state;
    return state?.brands?.length ? state : null;
  } catch {
    return null;
  }
}

/** Offers to move brands saved in this browser (before accounts existed) into the account. */
export default function ImportLocalData() {
  const hydrate = useStore((s) => s.hydrate);
  const [legacy, setLegacy] = useState<LegacyState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setLegacy(readLegacy()), []);
  if (!legacy) return null;

  const count = legacy.brands?.length ?? 0;

  const importNow = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(legacy),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      localStorage.removeItem(LEGACY_KEY);
      setLegacy(null);
      await hydrate();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setBusy(false);
  };

  const dismiss = () => {
    try {
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      /* ignore */
    }
    setLegacy(null);
  };

  return (
    <div className="mx-4 mt-4 md:mx-8 rounded-xl border border-border bg-card px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
      <p className="flex-1 min-w-[200px]">
        Found {count} {count === 1 ? "brand" : "brands"} saved in this browser. Move {count === 1 ? "it" : "them"} into your account?
        {error && <span className="block text-error text-xs mt-1">{error}</span>}
      </p>
      <Button size="sm" variant="ghost" onClick={dismiss} disabled={busy}>
        Discard
      </Button>
      <Button size="sm" onClick={importNow} loading={busy}>
        Import
      </Button>
    </div>
  );
}
