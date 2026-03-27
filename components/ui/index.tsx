"use client";
import clsx from "clsx";
import { forwardRef } from "react";

// ── Button ─────────────────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, children, className, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none",
        {
          "bg-accent text-white hover:bg-accent-light hover:-translate-y-px hover:shadow-accent":
            variant === "primary",
          "bg-transparent text-text-muted border border-border hover:border-accent hover:text-text":
            variant === "ghost",
          "bg-error/10 text-error border border-error/20 hover:bg-error/20":
            variant === "danger",
          "bg-success/10 text-success border border-success/20 hover:bg-success/20":
            variant === "success",
        },
        {
          "px-3 py-1.5 text-xs": size === "sm",
          "px-5 py-2.5 text-sm": size === "md",
          "px-7 py-3 text-base": size === "lg",
        },
        className
      )}
      {...props}
    >
      {loading && (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  )
);
Button.displayName = "Button";

// ── Input ──────────────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  prefix?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, prefix, error, className, ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {prefix && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-sm pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          className={clsx(
            "w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text",
            "focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10",
            "placeholder:text-text-muted transition-colors",
            prefix && "pl-8",
            error && "border-error focus:border-error focus:ring-error/10",
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  )
);
Input.displayName = "Input";

// ── Textarea ───────────────────────────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, className, ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        className={clsx(
          "w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text resize-none",
          "focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10",
          "placeholder:text-text-muted transition-colors",
          className
        )}
        {...props}
      />
    </div>
  )
);
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
        "bg-card border border-border rounded-2xl",
        hover && "cursor-pointer transition-all hover:border-accent/50 hover:-translate-y-0.5",
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
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3">
      {children}
    </p>
  );
}

// ── Chip / Badge ───────────────────────────────────────────────────────────
type ChipVariant = "accent" | "neutral" | "success" | "warn" | "error";

export function Chip({
  children,
  variant = "accent",
  className,
}: {
  children: React.ReactNode;
  variant?: ChipVariant;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium",
        {
          "bg-accent/10 text-accent-light border border-accent/20": variant === "accent",
          "bg-surface text-text-muted border border-border": variant === "neutral",
          "bg-success/10 text-success border border-success/20": variant === "success",
          "bg-warn/10 text-warn border border-warn/20": variant === "warn",
          "bg-error/10 text-error border border-error/20": variant === "error",
        },
        className
      )}
    >
      {children}
    </span>
  );
}

// ── Page header ────────────────────────────────────────────────────────────
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-text-muted mt-1.5 text-sm">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
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
  icon: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <div className="text-5xl opacity-40">{icon}</div>
      <div>
        <p className="font-semibold text-text mb-1">{title}</p>
        <p className="text-sm text-text-muted max-w-xs">{description}</p>
      </div>
      {action}
    </div>
  );
}

// ── Spinner ────────────────────────────────────────────────────────────────
export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      className="border-2 border-current border-t-transparent rounded-full animate-spin inline-block"
      style={{ width: size, height: size }}
    />
  );
}
