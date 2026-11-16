"use client";
import clsx from "clsx";
import { forwardRef } from "react";

// ── Button ─────────────────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, children, className, disabled, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-colors select-none",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        {
          "bg-accent text-accent-fg hover:bg-accent/85": variant === "primary",
          "bg-card text-text border border-border hover:bg-bg": variant === "secondary",
          "bg-transparent text-text-muted hover:text-text hover:bg-text/5": variant === "ghost",
          "bg-transparent text-error border border-error/30 hover:bg-error/5": variant === "danger",
          "bg-transparent text-success border border-success/30 hover:bg-success/5": variant === "success",
        },
        {
          "h-8 px-3 text-xs": size === "sm",
          "h-10 px-4 text-sm": size === "md",
          "h-12 px-6 text-[15px]": size === "lg",
        },
        className
      )}
      {...props}
    >
      {loading && <Spinner size={14} />}
      {children}
    </button>
  )
);
Button.displayName = "Button";

// ── Field label ────────────────────────────────────────────────────────────
export function FieldLabel({ children, htmlFor, hint }: { children: React.ReactNode; htmlFor?: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="block mb-1.5">
      <span className="text-sm font-medium text-text">{children}</span>
      {hint && <span className="block text-xs text-text-muted mt-0.5">{hint}</span>}
    </label>
  );
}

// ── Input ──────────────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  prefix?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, hint, prefix, error, className, id, ...props }, ref) => {
  const inputId = id ?? (label ? `in_${label.replace(/\W+/g, "_").toLowerCase()}` : undefined);
  return (
    <div className="w-full">
      {label && (
        <FieldLabel htmlFor={inputId} hint={hint}>
          {label}
        </FieldLabel>
      )}
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm pointer-events-none">{prefix}</span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            "w-full h-11 bg-surface border border-border rounded-xl px-3.5 text-sm text-text",
            "focus:outline-none focus:border-text/40 focus:ring-4 focus:ring-text/5 transition-colors",
            prefix && "pl-8",
            error && "border-error focus:border-error",
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="mt-1.5 text-xs text-error">{error}</p>}
    </div>
  );
});
Input.displayName = "Input";

// ── Select ─────────────────────────────────────────────────────────────────
interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  label?: string;
  hint?: string;
  options: readonly { key: string; label: string }[];
  placeholder?: string;
  onChange?: (value: string) => void;
}

export function Select({ label, hint, options, placeholder = "Choose…", onChange, className, id, ...props }: SelectProps) {
  const selectId = id ?? (label ? `sel_${label.replace(/\W+/g, "_").toLowerCase()}` : undefined);
  return (
    <div className="w-full">
      {label && (
        <FieldLabel htmlFor={selectId} hint={hint}>
          {label}
        </FieldLabel>
      )}
      <select
        id={selectId}
        onChange={(e) => onChange?.(e.target.value)}
        className={clsx(
          "w-full h-11 bg-surface border border-border rounded-xl px-3 text-sm text-text",
          "focus:outline-none focus:border-text/40 focus:ring-4 focus:ring-text/5 transition-colors",
          className
        )}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Textarea ───────────────────────────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ label, hint, className, id, ...props }, ref) => {
  const areaId = id ?? (label ? `ta_${label.replace(/\W+/g, "_").toLowerCase()}` : undefined);
  return (
    <div className="w-full">
      {label && (
        <FieldLabel htmlFor={areaId} hint={hint}>
          {label}
        </FieldLabel>
      )}
      <textarea
        ref={ref}
        id={areaId}
        className={clsx(
          "w-full bg-surface border border-border rounded-xl px-3.5 py-3 text-sm text-text resize-none",
          "focus:outline-none focus:border-text/40 focus:ring-4 focus:ring-text/5 transition-colors",
          className
        )}
        {...props}
      />
    </div>
  );
});
Textarea.displayName = "Textarea";

// ── Card ───────────────────────────────────────────────────────────────────
export function Card({
  children,
  className,
  hover = false,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        "bg-card border border-border rounded-2xl shadow-card",
        hover && "cursor-pointer transition-colors hover:border-text/25",
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  );
}

// ── Section label ──────────────────────────────────────────────────────────
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium text-text-muted mb-3">{children}</p>;
}

// ── Chip / Badge ───────────────────────────────────────────────────────────
type ChipVariant = "accent" | "neutral" | "success" | "warn" | "error";

export function Chip({ children, variant = "neutral", className }: { children: React.ReactNode; variant?: ChipVariant; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2.5 h-6 text-xs font-medium border",
        {
          "bg-text/5 text-text border-border": variant === "accent" || variant === "neutral",
          "bg-success/10 text-success border-success/20": variant === "success",
          "bg-warn/10 text-warn border-warn/25": variant === "warn",
          "bg-error/10 text-error border-error/20": variant === "error",
        },
        className
      )}
    >
      {children}
    </span>
  );
}

// ── Page header ────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-text-muted mt-1 text-sm max-w-2xl">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      {icon && typeof icon !== "string" && <div className="text-text-muted">{icon}</div>}
      <div>
        <p className="font-medium text-text mb-1">{title}</p>
        <p className="text-sm text-text-muted max-w-sm">{description}</p>
      </div>
      {action}
    </div>
  );
}

// ── Spinner ────────────────────────────────────────────────────────────────
export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className="border-2 border-current border-t-transparent rounded-full animate-spin inline-block shrink-0"
      style={{ width: size, height: size }}
    />
  );
}
