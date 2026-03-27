"use client";
import AppShell from "@/components/layout/AppShell";
import { useStore } from "@/lib/store";
import { Card, Chip, PageHeader, EmptyState, Button } from "@/components/ui";
import Link from "next/link";
import { format, parseISO, isAfter } from "date-fns";
import { PLATFORM_ICONS, PLATFORM_LABELS } from "@/lib/templates";
import type { Platform } from "@/lib/types";

export default function DashboardPage() {
  const { brands, getActiveBrand, posts, automationRules } = useStore();
  const activeBrand = getActiveBrand();

  const brandPosts = activeBrand
    ? posts.filter((p) => p.brandId === activeBrand.id)
    : [];
  const scheduledPosts = brandPosts.filter(
    (p) => p.status === "scheduled" && isAfter(parseISO(p.scheduledAt), new Date())
  );
  const publishedPosts = brandPosts.filter((p) => p.status === "published");
  const brandRules = activeBrand
    ? automationRules.filter((r) => r.brandId === activeBrand.id)
    : [];
  const activeRules = brandRules.filter((r) => r.status === "active");

  return (
    <AppShell>
      <div className="p-8 max-w-6xl mx-auto">
        {brands.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-accent-light flex items-center justify-center text-2xl mb-6 animate-spin-slow">
              ✦
            </div>
            <h1 className="font-display text-4xl font-bold mb-3">Welcome to Brandly</h1>
            <p className="text-text-muted text-lg mb-8 max-w-md">
              Start by building your Brand DNA — upload your website, Instagram, or product catalogue.
            </p>
            <Link href="/onboarding">
              <Button size="lg">Build Your First Brand →</Button>
            </Link>
          </div>
        ) : (
          <>
            <PageHeader
              title={activeBrand ? `${activeBrand.name}` : "Dashboard"}
              subtitle={activeBrand?.dna.one_liner}
              action={
                <Link href="/composer">
                  <Button>✏️ Create Post</Button>
                </Link>
              }
            />

            {/* Active brand colour bar */}
            {activeBrand && (
              <div className="flex gap-2 mb-8">
                {Object.entries(activeBrand.dna.colors).map(([name, hex]) => (
                  <div
                    key={name}
                    className="h-2 flex-1 rounded-full"
                    style={{ background: hex }}
                    title={`${name}: ${hex}`}
                  />
                ))}
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-8 stagger">
              {[
                { label: "Brands", value: brands.length, icon: "✦", href: "/onboarding" },
                { label: "Scheduled", value: scheduledPosts.length, icon: "📅", href: "/calendar" },
                { label: "Published", value: publishedPosts.length, icon: "✅", href: "/calendar" },
                { label: "Automations", value: activeRules.length, icon: "⚡", href: "/automation" },
              ].map(({ label, value, icon, href }) => (
                <Link key={label} href={href}>
                  <Card
                    hover
                    className="p-5 animate-fade-up"
                  >
                    <div className="text-2xl mb-3">{icon}</div>
                    <div className="text-3xl font-bold mb-0.5">{value}</div>
                    <div className="text-xs text-text-muted font-medium uppercase tracking-wider">
                      {label}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-6">
              {/* Upcoming posts */}
              <div className="col-span-2">
                <h2 className="font-semibold mb-4 flex items-center gap-2">
                  <span>📅</span> Upcoming Posts
                </h2>
                {scheduledPosts.length === 0 ? (
                  <EmptyState
                    icon="📝"
                    title="No scheduled posts"
                    description="Create your first AI-generated post and schedule it."
                    action={
                      <Link href="/composer">
                        <Button size="sm">Open Composer</Button>
                      </Link>
                    }
                  />
                ) : (
                  <div className="space-y-3">
                    {scheduledPosts.slice(0, 5).map((post) => (
                      <Card key={post.id} className="p-4 flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-lg shrink-0">
                          {PLATFORM_ICONS[post.platforms[0]] || "📱"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-text line-clamp-2 mb-2">
                            {post.content.caption}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            {post.platforms.map((p) => (
                              <Chip key={p} variant="neutral" className="text-[11px]">
                                {PLATFORM_ICONS[p]} {PLATFORM_LABELS[p as Platform]}
                              </Chip>
                            ))}
                            <span className="text-[11px] text-text-muted ml-auto">
                              {format(parseISO(post.scheduledAt), "MMM d, h:mm a")}
                            </span>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Sidebar: brand DNA + automations */}
              <div className="space-y-6">
                {/* Brand DNA quick view */}
                {activeBrand && (
                  <div>
                    <h2 className="font-semibold mb-4 flex items-center gap-2">
                      <span>✦</span> Brand DNA
                    </h2>
                    <Card className="p-4">
                      <div className="flex gap-2 mb-3 flex-wrap">
                        {activeBrand.dna.vibe.map((v) => (
                          <Chip key={v} variant="accent" className="text-[11px]">
                            {v}
                          </Chip>
                        ))}
                      </div>
                      <p className="text-xs text-text-muted mb-3">
                        {activeBrand.dna.communication_tone}
                      </p>
                      <div className="flex gap-1.5">
                        {Object.entries(activeBrand.dna.colors).map(([, hex]) => (
                          <div
                            key={hex}
                            className="w-6 h-6 rounded-md border border-border"
                            style={{ background: hex }}
                          />
                        ))}
                      </div>
                      <Link href="/onboarding" className="block mt-3">
                        <Button variant="ghost" size="sm" className="w-full">
                          Edit Brand DNA
                        </Button>
                      </Link>
                    </Card>
                  </div>
                )}

                {/* Automation rules */}
                <div>
                  <h2 className="font-semibold mb-4 flex items-center gap-2">
                    <span>⚡</span> Automations
                  </h2>
                  {brandRules.length === 0 ? (
                    <Card className="p-4 text-center">
                      <p className="text-xs text-text-muted mb-3">No automations yet</p>
                      <Link href="/automation">
                        <Button variant="ghost" size="sm" className="w-full">
                          Set Up Automation
                        </Button>
                      </Link>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {brandRules.slice(0, 3).map((rule) => (
                        <Card key={rule.id} className="p-3 flex items-center gap-3">
                          <div
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              rule.status === "active"
                                ? "bg-success"
                                : rule.status === "error"
                                ? "bg-error"
                                : "bg-text-muted"
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{rule.name}</p>
                            <p className="text-[11px] text-text-muted">{rule.postsGenerated} posts generated</p>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
