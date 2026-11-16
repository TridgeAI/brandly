"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { CalendarDays, Check, ChevronsUpDown, Home, LogOut, Palette, PenLine, Plus, Workflow } from "lucide-react";
import { useStore } from "@/lib/store";

export const NAV = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/brand", icon: Palette, label: "Brand" },
  { href: "/composer", icon: PenLine, label: "Create" },
  { href: "/calendar", icon: CalendarDays, label: "Calendar" },
  { href: "/automation", icon: Workflow, label: "Automations" },
];

function BrandDot({ colors, size = 20 }: { colors: string[]; size?: number }) {
  return (
    <span className="grid grid-cols-2 overflow-hidden rounded-md shrink-0 border border-border" style={{ width: size, height: size }}>
      {colors.slice(0, 4).map((c, i) => (
        <span key={i} style={{ background: c }} />
      ))}
    </span>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { brands, activeBrandId, setActiveBrand, getActiveBrand } = useStore();
  const activeBrand = getActiveBrand();
  const [open, setOpen] = useState(false);
  const colorsOf = (b: (typeof brands)[number]) => Object.values(b.dna.colors);

  return (
    <aside className="hidden md:flex w-60 shrink-0 h-screen bg-surface border-r border-border flex-col sticky top-0">
      <div className="px-4 h-14 flex items-center gap-2 border-b border-border">
        <span className="w-6 h-6 rounded-md bg-text text-bg grid place-items-center text-[13px] font-bold">B</span>
        <span className="text-[15px] font-semibold tracking-tight">Brandly</span>
      </div>

      {/* Brand switcher */}
      <div className="p-3 border-b border-border relative">
        {activeBrand ? (
          <button
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="w-full flex items-center gap-2.5 px-2 h-10 rounded-lg hover:bg-text/5 text-left"
          >
            <BrandDot colors={colorsOf(activeBrand)} />
            <span className="truncate text-sm font-medium flex-1">{activeBrand.name}</span>
            <ChevronsUpDown size={14} className="text-text-muted" />
          </button>
        ) : (
          <Link href="/onboarding" className="w-full flex items-center gap-2 px-2 h-10 rounded-lg text-sm font-medium hover:bg-text/5">
            <Plus size={16} /> Set up your brand
          </Link>
        )}
        {open && activeBrand && (
          <div className="absolute left-3 right-3 top-[52px] z-20 bg-card border border-border rounded-xl shadow-pop p-1 animate-fade-in">
            {brands.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  setActiveBrand(b.id);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-2 h-9 rounded-lg hover:bg-text/5 text-left text-sm"
              >
                <BrandDot colors={colorsOf(b)} size={16} />
                <span className="truncate flex-1">{b.name}</span>
                {b.id === activeBrandId && <Check size={14} />}
              </button>
            ))}
            <div className="h-px bg-border my-1" />
            <Link
              href="/onboarding"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2.5 px-2 h-9 rounded-lg hover:bg-text/5 text-sm text-text-muted"
            >
              <Plus size={14} /> Add a brand
            </Link>
          </div>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-0.5" aria-label="Main">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "flex items-center gap-3 px-2.5 h-9 rounded-lg text-sm transition-colors",
                active ? "bg-text/[0.07] text-text font-medium" : "text-text-muted hover:bg-text/5 hover:text-text"
              )}
            >
              <Icon size={16} strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>
      <AccountMenu />
    </aside>
  );
}

/** Signed-in user, workspace, data-use consent and sign out. */
function AccountMenu() {
  const account = useStore((s) => s.account);
  const [open, setOpen] = useState(false);
  const [optIn, setOptIn] = useState(account?.workspace.data_training_opt_in ?? false);
  if (!account) return null;
  const label = account.user.name || account.user.email || "Account";

  const toggleOptIn = async () => {
    const next = !optIn;
    setOptIn(next);
    const res = await fetch("/api/workspace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataTrainingOptIn: next }),
    }).catch(() => null);
    if (!res?.ok) setOptIn(!next);
  };

  return (
    <div className="p-3 border-t border-border relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 px-2 h-11 rounded-lg hover:bg-text/5 text-left"
      >
        <span className="w-7 h-7 rounded-full bg-text/10 grid place-items-center text-xs font-semibold uppercase shrink-0">{label.slice(0, 1)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{label}</span>
          <span className="block truncate text-xs text-text-muted">{account.workspace.name}</span>
        </span>
        <ChevronsUpDown size={14} className="text-text-muted" />
      </button>
      {open && (
        <div className="absolute left-3 right-3 bottom-[60px] z-20 bg-card border border-border rounded-xl shadow-pop p-1 animate-fade-in">
          {account.user.email && <p className="px-2 pt-1.5 pb-1 text-xs text-text-muted truncate">{account.user.email}</p>}
          <label className="flex items-start gap-2 px-2 py-2 rounded-lg hover:bg-text/5 text-sm cursor-pointer">
            <input type="checkbox" className="mt-0.5" checked={optIn} onChange={toggleOptIn} />
            <span>
              Help improve Brandly
              <span className="block text-xs text-text-muted">Let us use this workspace&apos;s edits and ratings to improve the AI.</span>
            </span>
          </label>
          <div className="h-px bg-border my-1" />
          <form action="/auth/signout" method="post">
            <button type="submit" className="w-full flex items-center gap-2.5 px-2 h-9 rounded-lg hover:bg-text/5 text-sm text-left">
              <LogOut size={14} /> Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/** Bottom tab bar on phones (the sidebar is hidden below md). */
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface border-t border-border grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
      {NAV.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || (href !== "/" && pathname.startsWith(href));
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={clsx("flex flex-col items-center justify-center gap-0.5 h-14 text-[11px]", active ? "text-text font-medium" : "text-text-muted")}>
            <Icon size={18} strokeWidth={1.75} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
