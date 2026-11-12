"use client";
import Link from "next/link";
import { addDays, format, isAfter, isBefore, parseISO } from "date-fns";
import { ArrowRight, Check, Sprout, Store } from "lucide-react";
import clsx from "clsx";
import AppShell from "@/components/layout/AppShell";
import { Button, Card } from "@/components/ui";
import { PlatformIcon } from "@/components/ui/icons";
import { useStore } from "@/lib/store";

export default function HomePage() {
  const { brands, getActiveBrand, posts, automationRules } = useStore();
  const brand = getActiveBrand();

  if (!brands.length || !brand) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
          <h1 className="text-3xl font-semibold tracking-tight">Posts that sound like you, every week.</h1>
          <p className="text-text-muted mt-3 text-[15px] leading-relaxed max-w-lg">
            Brandly learns your brand once, then writes, plans and schedules your social posts. Start with what you have.
          </p>
          <div className="mt-10 grid sm:grid-cols-2 gap-3">
            <Link href="/onboarding" className="rounded-2xl border border-border bg-card p-5 hover:border-text/30 transition-colors">
              <Store size={20} strokeWidth={1.75} />
              <p className="font-medium mt-3">I have a website or Instagram</p>
              <p className="text-sm text-text-muted mt-1">We read your colours, fonts and voice in about a minute.</p>
            </Link>
            <Link href="/onboarding" className="rounded-2xl border border-border bg-card p-5 hover:border-text/30 transition-colors">
              <Sprout size={20} strokeWidth={1.75} />
              <p className="font-medium mt-3">I&apos;m starting from scratch</p>
              <p className="text-sm text-text-muted mt-1">Answer a few questions and pick one of three directions.</p>
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const now = new Date();
  const weekEnd = addDays(now, 7);
  const brandPosts = posts.filter((p) => p.brandId === brand.id);
  const thisWeek = brandPosts
    .filter((p) => p.status === "scheduled" && isAfter(parseISO(p.scheduledAt), now) && isBefore(parseISO(p.scheduledAt), weekEnd))
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const drafts = brandPosts.filter((p) => p.status === "draft");
  const rules = automationRules.filter((r) => r.brandId === brand.id);
  const audience = brand.model?.strategy.audience;
  const audienceConfirmed = !!brand.model && Object.entries(brand.model.meta).some(([p, m]) => p.startsWith("strategy.audience") && m.source === "user");

  const checklist = [
    { done: true, label: "Set up your brand", href: "/brand" },
    { done: audienceConfirmed || !!audience?.ageGroups.length, label: "Confirm who your audience is", href: "/brand#section-strategy.audience" },
    { done: brandPosts.length > 0, label: "Write your first post", href: "/composer" },
    { done: brandPosts.some((p) => p.status === "scheduled" || p.status === "published"), label: "Schedule a post", href: "/calendar" },
    { done: rules.length > 0, label: "Turn on one automation", href: "/automation" },
  ];
  const remaining = checklist.filter((c) => !c.done).length;
  const colors = Object.values(brand.dna.colors);

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
          <div>
            <p className="text-xs text-text-muted">{format(now, "EEEE, d MMMM")}</p>
            <h1 className="text-2xl font-semibold tracking-tight mt-0.5">{brand.name}</h1>
          </div>
          <Link href="/composer">
            <Button>
              Write a post <ArrowRight size={16} />
            </Button>
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6 min-w-0">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-medium">This week</h2>
                <Link href="/calendar" className="text-sm text-text-muted hover:text-text">
                  Calendar
                </Link>
              </div>
              {thisWeek.length === 0 ? (
                <p className="text-sm text-text-muted py-6 text-center">
                  Nothing scheduled for the next 7 days.{" "}
                  <Link href="/composer" className="underline underline-offset-2 hover:text-text">
                    Write a post
                  </Link>
                </p>
              ) : (
                <ul className="divide-y divide-border -mx-5">
                  {thisWeek.map((p) => (
                    <li key={p.id} className="px-5 py-3 flex items-center gap-4">
                      <div className="w-14 shrink-0 text-center">
                        <p className="text-xs text-text-muted">{format(parseISO(p.scheduledAt), "EEE")}</p>
                        <p className="text-sm font-medium tabular-nums">{format(parseISO(p.scheduledAt), "HH:mm")}</p>
                      </div>
                      <p className="text-sm flex-1 min-w-0 truncate">{p.content.caption}</p>
                      <span className="flex gap-1.5 text-text-muted">
                        {p.platforms.map((pl) => (
                          <PlatformIcon key={pl} platform={pl} />
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-medium">Drafts to review</h2>
                <span className="text-sm text-text-muted tabular-nums">{drafts.length}</span>
              </div>
              {drafts.length === 0 ? (
                <p className="text-sm text-text-muted">No drafts waiting.</p>
              ) : (
                <ul className="space-y-2">
                  {drafts.slice(0, 5).map((p) => (
                    <li key={p.id}>
                      <Link href="/calendar" className="flex items-center gap-3 rounded-lg border border-border px-3 h-11 hover:border-text/30">
                        <span className="text-sm truncate flex-1">{p.content.caption}</span>
                        <ArrowRight size={14} className="text-text-muted shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            {remaining > 0 && (
              <Card className="p-5">
                <h2 className="font-medium">Get set up</h2>
                <p className="text-xs text-text-muted mt-0.5">{remaining} left</p>
                <ul className="mt-4 space-y-1">
                  {checklist.map((c) => (
                    <li key={c.label}>
                      <Link href={c.href} className="flex items-center gap-3 h-9 px-1 rounded-lg hover:bg-text/5">
                        <span className={clsx("w-5 h-5 rounded-full border grid place-items-center shrink-0", c.done ? "bg-text border-text text-bg" : "border-border")}>
                          {c.done && <Check size={12} strokeWidth={3} />}
                        </span>
                        <span className={clsx("text-sm", c.done && "text-text-muted line-through")}>{c.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <Card className="p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">Your brand</h2>
                <Link href="/brand" className="text-sm text-text-muted hover:text-text">
                  Edit
                </Link>
              </div>
              <div className="grid grid-cols-4 rounded-lg overflow-hidden border border-border h-10 mt-4">
                {colors.map((c, i) => (
                  <span key={i} style={{ background: c }} />
                ))}
              </div>
              {brand.dna.one_liner && <p className="text-sm text-text-muted mt-4 leading-relaxed">{brand.dna.one_liner}</p>}
              {brand.dna.vibe.length > 0 && <p className="text-xs text-text-muted mt-3">{brand.dna.vibe.slice(0, 4).join(" · ")}</p>}
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
