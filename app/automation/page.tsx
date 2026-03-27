"use client";
import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { useStore } from "@/lib/store";
import { Button, Input, Card, Chip, SectionLabel, PageHeader, EmptyState } from "@/components/ui";
import Link from "next/link";
import type { AutomationRule, Platform, TriggerConfig } from "@/lib/types";
import { PLATFORM_ICONS, PLATFORM_LABELS } from "@/lib/templates";
import { format, parseISO } from "date-fns";

type TriggerType = "rss" | "recurring" | "product_update";
const PLATFORMS: Platform[] = ["instagram", "facebook", "linkedin", "twitter"];

const TRIGGER_META: Record<TriggerType, { icon: string; label: string; description: string }> = {
  rss: {
    icon: "📡",
    label: "RSS Feed",
    description: "Auto-generate posts when new articles are published to a feed",
  },
  recurring: {
    icon: "🔁",
    label: "Recurring Post",
    description: "Generate and schedule posts on a fixed interval",
  },
  product_update: {
    icon: "🛍️",
    label: "Product Update",
    description: "Auto-post when new products are detected on a URL",
  },
};

const STATUS_COLORS = {
  active: "bg-success/10 text-success border border-success/20",
  paused: "bg-text-muted/10 text-text-muted border border-border",
  error: "bg-error/10 text-error border border-error/20",
};

export default function AutomationPage() {
  const { getActiveBrand, automationRules, addRule, updateRule, deleteRule } = useStore();
  const brand = getActiveBrand();
  const [showForm, setShowForm] = useState(false);
  const [triggerType, setTriggerType] = useState<TriggerType>("rss");
  const [ruleName, setRuleName] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [intervalDays, setIntervalDays] = useState(3);
  const [timeOfDay, setTimeOfDay] = useState("09:00");
  const [topic, setTopic] = useState("");
  const [checkInterval, setCheckInterval] = useState(6);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(["instagram"]);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const brandRules = brand ? automationRules.filter((r) => r.brandId === brand.id) : [];

  const togglePlatform = (p: Platform) =>
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );

  const saveRule = async () => {
    if (!brand || !ruleName.trim()) return;
    setSaving(true);

    let trigger: TriggerConfig;
    if (triggerType === "rss") {
      trigger = { type: "rss", feedUrl, checkIntervalHours: checkInterval };
    } else if (triggerType === "recurring") {
      trigger = { type: "recurring", intervalDays, timeOfDay, topic };
    } else {
      trigger = { type: "product_update", sourceUrl };
    }

    const rule: AutomationRule = {
      id: `rule_${Date.now()}`,
      brandId: brand.id,
      name: ruleName,
      trigger,
      platforms: selectedPlatforms,
      status: "active",
      postsGenerated: 0,
      createdAt: new Date().toISOString(),
      nextRun: new Date(Date.now() + 1000 * 60 * 60).toISOString(), // 1h from now
    };

    addRule(rule);
    setSaving(false);
    setShowForm(false);
    setRuleName("");
    setFeedUrl("");
    setSourceUrl("");
    setTopic("");
  };

  const testRule = async (rule: AutomationRule) => {
    if (!brand) return;
    setTestingId(rule.id);
    try {
      const context =
        rule.trigger.type === "rss"
          ? `New article from RSS feed: ${rule.trigger.feedUrl}`
          : rule.trigger.type === "recurring"
          ? `Recurring post — topic: ${(rule.trigger as any).topic || "general brand content"}`
          : `New product detected at: ${(rule.trigger as any).sourceUrl}`;

      await fetch("/api/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandDNA: brand.dna,
          triggerType: rule.trigger.type,
          triggerContext: context,
          platforms: rule.platforms,
        }),
      });
      updateRule(rule.id, { postsGenerated: rule.postsGenerated + 1 });
    } catch {}
    setTestingId(null);
  };

  if (!brand) {
    return (
      <AppShell>
        <div className="p-8">
          <EmptyState
            icon="⚡"
            title="No brand selected"
            description="Create a brand first to set up automation rules."
            action={<Link href="/onboarding"><Button>Create Brand</Button></Link>}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-8 max-w-5xl mx-auto">
        <PageHeader
          title="Automation"
          subtitle={`Auto-generate content for ${brand.name}`}
          action={
            <Button onClick={() => setShowForm(true)}>+ New Rule</Button>
          }
        />

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            ["Active Rules", brandRules.filter((r) => r.status === "active").length, "text-success"],
            ["Total Posts Generated", brandRules.reduce((a, r) => a + r.postsGenerated, 0), "text-accent-light"],
            ["Paused Rules", brandRules.filter((r) => r.status === "paused").length, "text-text-muted"],
          ].map(([label, value, color]) => (
            <Card key={label as string} className="p-4 text-center">
              <p className={`text-3xl font-bold mb-1 ${color as string}`}>{value as number}</p>
              <p className="text-xs text-text-muted">{label as string}</p>
            </Card>
          ))}
        </div>

        {/* ── New rule form ── */}
        {showForm && (
          <Card className="p-6 mb-6 border-accent/30">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-lg">New Automation Rule</h3>
              <button onClick={() => setShowForm(false)} className="text-text-muted hover:text-text text-xl">×</button>
            </div>

            {/* Trigger type */}
            <SectionLabel>Trigger Type</SectionLabel>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {(Object.entries(TRIGGER_META) as [TriggerType, typeof TRIGGER_META[TriggerType]][]).map(([type, meta]) => (
                <button
                  key={type}
                  onClick={() => setTriggerType(type)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    triggerType === type
                      ? "bg-accent/10 border-accent/40"
                      : "border-border hover:border-accent/30"
                  }`}
                >
                  <span className="text-2xl block mb-2">{meta.icon}</span>
                  <p className="text-sm font-semibold mb-1">{meta.label}</p>
                  <p className="text-xs text-text-muted">{meta.description}</p>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <Input
                label="Rule Name"
                placeholder="e.g. Weekly blog roundup"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
              />

              {triggerType === "rss" && (
                <>
                  <Input
                    label="RSS Feed URL"
                    placeholder="https://yourblog.com/rss.xml"
                    value={feedUrl}
                    onChange={(e) => setFeedUrl(e.target.value)}
                  />
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                      Check Every (hours)
                    </label>
                    <select
                      value={checkInterval}
                      onChange={(e) => setCheckInterval(Number(e.target.value))}
                      className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text focus:outline-none focus:border-accent"
                    >
                      {[1, 2, 4, 6, 12, 24].map((h) => (
                        <option key={h} value={h}>{h}h</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {triggerType === "recurring" && (
                <>
                  <Input
                    label="Topic / Focus"
                    placeholder="e.g. Product tips"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                  />
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                      Every (days)
                    </label>
                    <select
                      value={intervalDays}
                      onChange={(e) => setIntervalDays(Number(e.target.value))}
                      className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text focus:outline-none focus:border-accent"
                    >
                      {[1, 2, 3, 5, 7, 14, 30].map((d) => (
                        <option key={d} value={d}>Every {d} day{d > 1 ? "s" : ""}</option>
                      ))}
                    </select>
                  </div>
                  <Input
                    label="Post Time"
                    type="time"
                    value={timeOfDay}
                    onChange={(e) => setTimeOfDay(e.target.value)}
                  />
                </>
              )}

              {triggerType === "product_update" && (
                <Input
                  label="Product Source URL"
                  placeholder="https://yourstore.com/products"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                />
              )}
            </div>

            {/* Platforms */}
            <SectionLabel>Post To</SectionLabel>
            <div className="flex gap-2 mb-5 flex-wrap">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                    selectedPlatforms.includes(p)
                      ? "bg-accent/10 border-accent/40 text-text"
                      : "border-border text-text-muted hover:border-accent/30"
                  }`}
                >
                  <span>{PLATFORM_ICONS[p]}</span>
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>

            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button
                loading={saving}
                disabled={!ruleName.trim() || selectedPlatforms.length === 0}
                onClick={saveRule}
              >
                Save Rule
              </Button>
            </div>
          </Card>
        )}

        {/* ── Rules list ── */}
        {brandRules.length === 0 && !showForm ? (
          <EmptyState
            icon="⚡"
            title="No automation rules yet"
            description="Set up RSS feeds, recurring posts, or product update triggers to auto-generate content."
            action={<Button onClick={() => setShowForm(true)}>+ Create First Rule</Button>}
          />
        ) : (
          <div className="space-y-4">
            {brandRules.map((rule) => {
              const meta = TRIGGER_META[rule.trigger.type as TriggerType];
              return (
                <Card key={rule.id} className="p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-xl shrink-0">
                        {meta?.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <h3 className="font-semibold">{rule.name}</h3>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[rule.status]}`}>
                            {rule.status}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted mb-2">{meta?.label}</p>
                        <div className="flex gap-1.5 flex-wrap mb-2">
                          {rule.platforms.map((p) => (
                            <Chip key={p} variant="neutral" className="text-[10px]">
                              {PLATFORM_ICONS[p]} {PLATFORM_LABELS[p as Platform]}
                            </Chip>
                          ))}
                        </div>
                        {/* Trigger detail */}
                        <div className="text-xs text-text-muted">
                          {rule.trigger.type === "rss" && (
                            <span>📡 {(rule.trigger as any).feedUrl} · every {(rule.trigger as any).checkIntervalHours}h</span>
                          )}
                          {rule.trigger.type === "recurring" && (
                            <span>🔁 Every {(rule.trigger as any).intervalDays}d at {(rule.trigger as any).timeOfDay}</span>
                          )}
                          {rule.trigger.type === "product_update" && (
                            <span>🛍️ Watching {(rule.trigger as any).sourceUrl}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stats + actions */}
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <p className="text-lg font-bold text-accent-light">{rule.postsGenerated}</p>
                        <p className="text-[10px] text-text-muted">posts generated</p>
                      </div>
                      {rule.nextRun && (
                        <div className="text-right">
                          <p className="text-xs font-medium">{format(parseISO(rule.nextRun), "MMM d, h:mm a")}</p>
                          <p className="text-[10px] text-text-muted">next run</p>
                        </div>
                      )}
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={testingId === rule.id}
                          onClick={() => testRule(rule)}
                        >
                          Test Run
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            updateRule(rule.id, {
                              status: rule.status === "active" ? "paused" : "active",
                            })
                          }
                        >
                          {rule.status === "active" ? "Pause" : "Resume"}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => deleteRule(rule.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* How it works */}
        <Card className="mt-8 p-6">
          <h3 className="font-semibold mb-4">How Automation Works</h3>
          <div className="grid grid-cols-3 gap-6">
            {[
              ["1. Trigger fires", "RSS feed publishes an article, your recurring schedule hits, or a new product is detected."],
              ["2. Claude generates", "The post is created using your Brand DNA — caption, hashtags, image prompt, and CTA all on-brand."],
              ["3. Scheduled & posted", "The post is added to your calendar queue and published at the optimal time."],
            ].map(([title, desc]) => (
              <div key={title as string}>
                <p className="font-semibold text-sm mb-1 text-accent-light">{title as string}</p>
                <p className="text-xs text-text-muted leading-relaxed">{desc as string}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
