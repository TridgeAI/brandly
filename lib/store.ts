"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Brand, ScheduledPost, AutomationRule } from "./types";
import type { BrandModel } from "./brand/model";
import { toBrandDNA } from "./brand/projection";

// The database (Supabase) is the source of truth. This store is the in-memory cache the
// pages read from: actions update it immediately, then sync to /api/* in the background.
// Only UI preferences (active brand, sidebar) are kept in localStorage.

export type VersionSource = "user" | "stage" | "build";

export interface Account {
  user: { id: string; email?: string; name: string | null };
  workspace: { id: string; name: string; plan: string; data_training_opt_in: boolean };
}

interface AppState {
  // Session
  hydrated: boolean;
  loadError: string | null;
  account: Account | null;
  syncError: string | null;
  hydrate: () => Promise<void>;
  clearSyncError: () => void;

  // Brands
  brands: Brand[];
  activeBrandId: string | null;
  addBrand: (brand: Brand) => void;
  updateBrand: (id: string, updates: Partial<Brand>) => void;
  deleteBrand: (id: string) => void;
  setActiveBrand: (id: string) => void;
  getActiveBrand: () => Brand | null;
  /** Saves a Brand Model as a new version and keeps the legacy `dna` projection in sync. */
  saveBrandModel: (model: BrandModel, sources?: Brand["sources"], opts?: { source?: VersionSource; stageId?: string }) => void;

  // Posts
  posts: ScheduledPost[];
  addPost: (post: ScheduledPost, meta?: { template?: string; topic?: string }) => void;
  updatePost: (id: string, updates: Partial<ScheduledPost>) => void;
  deletePost: (id: string) => void;
  getPostsByBrand: (brandId: string) => ScheduledPost[];

  // Automation
  automationRules: AutomationRule[];
  addRule: (rule: AutomationRule) => void;
  updateRule: (id: string, updates: Partial<AutomationRule>) => void;
  deleteRule: (id: string) => void;
  getRulesByBrand: (brandId: string) => AutomationRule[];

  // UI state
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

// ── Background sync ────────────────────────────────────────────────────────
// Requests for the same record run in order (a post's PATCH never overtakes its POST).
const queues = new Map<string, Promise<unknown>>();

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

function sync(key: string, method: string, path: string, body?: unknown) {
  const prev = queues.get(key) ?? Promise.resolve();
  const next = prev
    .catch(() => undefined)
    .then(() => api(method, path, body))
    .catch((err: Error) => {
      console.error(`[sync] ${method} ${path}`, err);
      useStore.setState({ syncError: `Couldn't save your changes: ${err.message}` });
    });
  queues.set(key, next);
  return next;
}

/** Waits for pending saves of one record (e.g. a brand) before a dependent request. */
export function afterSync(key: string) {
  return queues.get(key) ?? Promise.resolve();
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ── Session ─────────────────────────────────────────────────────────
      hydrated: false,
      loadError: null,
      account: null,
      syncError: null,
      clearSyncError: () => set({ syncError: null }),

      hydrate: async () => {
        try {
          const data = await api("GET", "/api/bootstrap");
          const brands = data.brands as Brand[];
          const active = get().activeBrandId;
          set({
            hydrated: true,
            loadError: null,
            account: { user: data.user, workspace: data.workspace },
            brands,
            posts: data.posts,
            automationRules: data.rules,
            activeBrandId: brands.some((b) => b.id === active) ? active : brands[0]?.id ?? null,
          });
        } catch (err) {
          set({ loadError: err instanceof Error ? err.message : String(err) });
        }
      },

      // ── Brands ──────────────────────────────────────────────────────────
      brands: [],
      activeBrandId: null,

      addBrand: (brand) => {
        set((s) => ({ brands: [...s.brands, brand], activeBrandId: s.activeBrandId ?? brand.id }));
        if (brand.model) sync(brand.id, "PUT", `/api/brands/${brand.id}`, { model: brand.model, sources: brand.sources, source: "user" });
      },

      updateBrand: (id, updates) => {
        set((s) => ({
          brands: s.brands.map((b) => (b.id === id ? { ...b, ...updates, updatedAt: new Date().toISOString() } : b)),
        }));
        const b = get().brands.find((x) => x.id === id);
        if (b?.model) sync(id, "PUT", `/api/brands/${id}`, { model: { ...b.model, name: b.name }, sources: b.sources, source: "user" });
      },

      // The database removes the brand's posts and rules with it (FK cascade).
      deleteBrand: (id) => {
        set((s) => ({
          brands: s.brands.filter((b) => b.id !== id),
          posts: s.posts.filter((p) => p.brandId !== id),
          automationRules: s.automationRules.filter((r) => r.brandId !== id),
          activeBrandId: s.activeBrandId === id ? (s.brands.find((b) => b.id !== id)?.id ?? null) : s.activeBrandId,
        }));
        sync(id, "DELETE", `/api/brands/${id}`);
      },

      setActiveBrand: (id) => set({ activeBrandId: id }),

      saveBrandModel: (model, sources, opts) => {
        const now = new Date().toISOString();
        const existing = get().brands.find((b) => b.id === model.id);
        const brand: Brand = {
          id: model.id,
          name: model.name,
          dna: toBrandDNA(model),
          model,
          sources: sources ?? existing?.sources ?? {},
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        set((s) => ({
          brands: existing ? s.brands.map((b) => (b.id === model.id ? brand : b)) : [...s.brands, brand],
          activeBrandId: model.id,
        }));
        sync(model.id, "PUT", `/api/brands/${model.id}`, {
          model,
          sources: brand.sources,
          source: opts?.source ?? "user",
          stageId: opts?.stageId,
        });
      },

      getActiveBrand: () => {
        const { brands, activeBrandId } = get();
        return brands.find((b) => b.id === activeBrandId) ?? null;
      },

      // ── Posts ────────────────────────────────────────────────────────────
      posts: [],

      addPost: (post, meta) => {
        set((s) => ({ posts: [...s.posts, post] }));
        // A brand created moments ago may still be saving.
        afterSync(post.brandId).then(() => sync(post.id, "POST", "/api/posts", { post, ...meta }));
      },

      updatePost: (id, updates) => {
        set((s) => ({ posts: s.posts.map((p) => (p.id === id ? { ...p, ...updates } : p)) }));
        sync(id, "PATCH", `/api/posts/${id}`, updates);
      },

      deletePost: (id) => {
        set((s) => ({ posts: s.posts.filter((p) => p.id !== id) }));
        sync(id, "DELETE", `/api/posts/${id}`);
      },

      getPostsByBrand: (brandId) => get().posts.filter((p) => p.brandId === brandId),

      // ── Automation ───────────────────────────────────────────────────────
      automationRules: [],

      addRule: (rule) => {
        set((s) => ({ automationRules: [...s.automationRules, rule] }));
        afterSync(rule.brandId).then(() => sync(rule.id, "POST", "/api/rules", rule));
      },

      updateRule: (id, updates) => {
        set((s) => ({ automationRules: s.automationRules.map((r) => (r.id === id ? { ...r, ...updates } : r)) }));
        sync(id, "PATCH", `/api/rules/${id}`, updates);
      },

      deleteRule: (id) => {
        set((s) => ({ automationRules: s.automationRules.filter((r) => r.id !== id) }));
        sync(id, "DELETE", `/api/rules/${id}`);
      },

      getRulesByBrand: (brandId) => get().automationRules.filter((r) => r.brandId === brandId),

      // ── UI ───────────────────────────────────────────────────────────────
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
    }),
    {
      // New key: the old "brandly-store" (all data in the browser) is left untouched
      // until the user imports it (see components/layout/ImportLocalData.tsx).
      name: "brandly-ui",
      version: 1,
      partialize: (s) => ({ activeBrandId: s.activeBrandId, sidebarOpen: s.sidebarOpen }),
    }
  )
);
