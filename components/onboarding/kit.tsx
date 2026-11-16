"use client";
import clsx from "clsx";
import { AlertTriangle, ArrowLeft, Check, CircleDashed, Lock, LockOpen, X } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import type { Finding } from "@/lib/brand/stages/types";
import type { FieldSource } from "@/lib/brand/model";

// ── Shell: one topic per screen, one primary action ───────────────────────
export function OnboardingShell({
  step,
  total,
  title,
  subtitle,
  onBack,
  children,
  primary,
  secondary,
  wide = false,
}: {
  step?: number;
  total?: number;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children: React.ReactNode;
  primary?: { label: string; onClick: () => void; disabled?: boolean; loading?: boolean };
  secondary?: { label: string; onClick: () => void };
  wide?: boolean;
}) {
  return (
    <div className={clsx("mx-auto px-4 sm:px-6 py-8 sm:py-12", wide ? "max-w-5xl" : "max-w-xl")}>
      <div className="flex items-center justify-between h-8 mb-6">
        {onBack ? (
          <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text">
            <ArrowLeft size={16} /> Back
          </button>
        ) : (
          <span />
        )}
        {step && total ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-muted tabular-nums">
              Step {step} of {total}
            </span>
            <div className="w-24 h-1 rounded-full bg-border overflow-hidden" aria-hidden>
              <div className="h-full bg-text transition-all" style={{ width: `${(step / total) * 100}%` }} />
            </div>
          </div>
        ) : null}
      </div>
      <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight leading-tight">{title}</h1>
      {subtitle && <p className="mt-2 text-text-muted text-[15px] leading-relaxed">{subtitle}</p>}
      <div className="mt-8 animate-fade-up">{children}</div>
      {(primary || secondary) && (
        <div className="mt-10 flex items-center justify-between gap-3 flex-wrap">
          {secondary ? (
            <button onClick={secondary.onClick} className="text-sm text-text-muted hover:text-text underline-offset-4 hover:underline">
              {secondary.label}
            </button>
          ) : (
            <span />
          )}
          {primary && (
            <Button size="lg" onClick={primary.onClick} disabled={primary.disabled} loading={primary.loading}>
              {primary.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Big choice card ────────────────────────────────────────────────────────
export function ChoiceCard({
  icon,
  title,
  description,
  selected,
  onClick,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={clsx(
        "w-full text-left rounded-2xl border p-5 transition-colors flex gap-4 items-start bg-card",
        selected ? "border-text ring-1 ring-text" : "border-border hover:border-text/30"
      )}
    >
      {icon && <span className="mt-0.5 text-text">{icon}</span>}
      <span className="flex-1 min-w-0">
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-text-muted mt-1 leading-relaxed">{description}</span>
      </span>
      <span
        className={clsx(
          "mt-1 w-5 h-5 rounded-full border grid place-items-center shrink-0",
          selected ? "bg-text border-text text-bg" : "border-border"
        )}
      >
        {selected && <Check size={12} strokeWidth={3} />}
      </span>
    </button>
  );
}

// ── Chip group (single or multi select) ────────────────────────────────────
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  multi = false,
  max,
  label,
}: {
  options: { value: T; label: string }[];
  value: T[];
  onChange: (v: T[]) => void;
  multi?: boolean;
  max?: number;
  label?: string;
}) {
  const toggle = (v: T) => {
    if (!multi) return onChange(value[0] === v ? [] : [v]);
    if (value.includes(v)) return onChange(value.filter((x) => x !== v));
    if (max && value.length >= max) return onChange([...value.slice(1), v]);
    onChange([...value, v]);
  };
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            onClick={() => toggle(o.value)}
            aria-pressed={on}
            className={clsx(
              "h-10 px-4 rounded-full border text-sm transition-colors inline-flex items-center gap-1.5",
              on ? "bg-text text-bg border-text" : "bg-card border-border hover:border-text/30"
            )}
          >
            {on && multi && <Check size={14} strokeWidth={2.5} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Tier cards (spending level) ───────────────────────────────────────────
export function TierCards<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; example: string }[];
  value?: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {options.map((o, i) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={clsx(
            "text-left rounded-xl border p-4 transition-colors bg-card",
            value === o.value ? "border-text ring-1 ring-text" : "border-border hover:border-text/30"
          )}
        >
          <span className="flex items-center justify-between">
            <span className="font-medium text-sm">{o.label}</span>
            <span className="text-xs text-text-muted tracking-wider" aria-hidden>
              {"₹".repeat(i + 1)}
            </span>
          </span>
          <span className="block text-xs text-text-muted mt-1 leading-relaxed">{o.example}</span>
        </button>
      ))}
    </div>
  );
}

// ── Question block ────────────────────────────────────────────────────────
export function Question({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mb-8 last:mb-0">
      <h2 className="text-[15px] font-medium">{title}</h2>
      {hint && <p className="text-xs text-text-muted mt-1">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

// ── Live findings (replaces fake progress logs) ───────────────────────────
export function LiveFindings({ findings, running }: { findings: Finding[]; running: boolean }) {
  return (
    <ul className="divide-y divide-border rounded-2xl border border-border bg-card" aria-live="polite">
      {findings.map((f) => (
        <li key={f.id} className="flex gap-3 px-4 py-3.5 animate-fade-in">
          <span className="mt-0.5 shrink-0">
            {f.status === "info" ? (
              <Spinner size={16} />
            ) : f.status === "done" ? (
              <span className="w-4 h-4 rounded-full bg-success/15 text-success grid place-items-center">
                <Check size={11} strokeWidth={3} />
              </span>
            ) : f.status === "warn" ? (
              <AlertTriangle size={16} className="text-warn" />
            ) : (
              <X size={16} className="text-error" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm">{f.label}</p>
            {f.detail && <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{f.detail}</p>}
            {f.swatches && f.swatches.length > 0 && (
              <div className="flex gap-1.5 mt-2">
                {f.swatches.map((c) => (
                  <span key={c} title={c} className="w-6 h-6 rounded-md border border-border" style={{ background: c }} />
                ))}
              </div>
            )}
            {f.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.image} alt="" className="mt-2 h-8 max-w-[140px] object-contain rounded bg-white p-1 border border-border" />
            )}
          </div>
        </li>
      ))}
      {running && (
        <li className="flex gap-3 px-4 py-3.5 text-text-muted">
          <CircleDashed size={16} className="animate-spin-slow mt-0.5" />
          <span className="text-sm">Working…</span>
        </li>
      )}
    </ul>
  );
}

// ── Source tag + lock (brand profile cards) ───────────────────────────────
const SOURCE_TEXT: Record<FieldSource, string> = {
  extracted: "From your sources",
  inferred: "Suggested",
  user: "You set this",
  generated: "Suggested",
};

export function SourceTag({ source, needsCheck }: { source?: FieldSource; needsCheck?: boolean }) {
  if (needsCheck)
    return (
      <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-xs font-medium bg-warn/10 text-warn border border-warn/25">
        <AlertTriangle size={12} /> Check this
      </span>
    );
  if (!source) return null;
  return <span className="text-xs text-text-muted">{SOURCE_TEXT[source]}</span>;
}

export function LockButton({ locked, onToggle }: { locked: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={locked}
      title={locked ? "Locked: Brandly won't change this" : "Lock so Brandly won't change this"}
      className={clsx("w-8 h-8 rounded-lg grid place-items-center hover:bg-text/5", locked ? "text-text" : "text-text-muted")}
    >
      {locked ? <Lock size={15} /> : <LockOpen size={15} />}
      <span className="sr-only">{locked ? "Unlock" : "Lock"}</span>
    </button>
  );
}
