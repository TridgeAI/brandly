"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import clsx from "clsx";

const NAV = [
  { href: "/", icon: "⬡", label: "Dashboard" },
  { href: "/onboarding", icon: "✦", label: "Brand Intelligence" },
  { href: "/composer", icon: "✏️", label: "AI Composer" },
  { href: "/calendar", icon: "📅", label: "Calendar" },
  { href: "/automation", icon: "⚡", label: "Automation" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { brands, activeBrandId, setActiveBrand, getActiveBrand } = useStore();
  const activeBrand = getActiveBrand();

  return (
    <aside className="w-60 shrink-0 h-screen bg-surface border-r border-border flex flex-col sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-light flex items-center justify-center text-sm font-bold text-white">
          ✦
        </div>
        <span className="font-display text-lg font-bold tracking-tight">Brandly</span>
      </div>

      {/* Brand switcher */}
      {brands.length > 0 && (
        <div className="px-3 py-3 border-b border-border">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted px-2 mb-2">
            Active Brand
          </p>
          <div className="space-y-1">
            {brands.map((b) => (
              <button
                key={b.id}
                onClick={() => setActiveBrand(b.id)}
                className={clsx(
                  "w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left transition-all text-sm",
                  b.id === activeBrandId
                    ? "bg-accent/10 text-accent-light border border-accent/20"
                    : "text-text-muted hover:bg-card hover:text-text"
                )}
              >
                <div
                  className="w-5 h-5 rounded shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${b.dna.colors.primary}, ${b.dna.colors.secondary})`,
                  }}
                />
                <span className="truncate font-medium">{b.name}</span>
                {b.id === activeBrandId && (
                  <span className="ml-auto text-[10px] text-accent">✓</span>
                )}
              </button>
            ))}
          </div>
          <Link
            href="/onboarding"
            className="mt-2 w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] text-text-muted hover:text-text transition-colors"
          >
            <span>+</span> Add brand
          </Link>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ href, icon, label }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                active
                  ? "bg-accent/10 text-accent-light border border-accent/20"
                  : "text-text-muted hover:bg-card hover:text-text"
              )}
            >
              <span className="text-base w-5 text-center">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: active brand colour strip */}
      {activeBrand && (
        <div className="px-4 py-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg shrink-0"
              style={{
                background: `linear-gradient(135deg, ${activeBrand.dna.colors.primary}, ${activeBrand.dna.colors.secondary})`,
              }}
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">{activeBrand.name}</p>
              <p className="text-[11px] text-text-muted truncate">
                {activeBrand.dna.vibe.slice(0, 2).join(" · ")}
              </p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
