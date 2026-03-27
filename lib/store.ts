"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Brand, ScheduledPost, AutomationRule, Platform } from "./types";

interface AppState {
  // Brands
  brands: Brand[];
  activeBrandId: string | null;
  addBrand: (brand: Brand) => void;
  updateBrand: (id: string, updates: Partial<Brand>) => void;
  deleteBrand: (id: string) => void;
  setActiveBrand: (id: string) => void;
  getActiveBrand: () => Brand | null;

  // Posts
  posts: ScheduledPost[];
  addPost: (post: ScheduledPost) => void;
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

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ── Brands ──────────────────────────────────────────────────────────
      brands: [],
      activeBrandId: null,

      addBrand: (brand) =>
        set((s) => ({
          brands: [...s.brands, brand],
          activeBrandId: s.activeBrandId ?? brand.id,
        })),

      updateBrand: (id, updates) =>
        set((s) => ({
          brands: s.brands.map((b) =>
            b.id === id ? { ...b, ...updates, updatedAt: new Date().toISOString() } : b
          ),
        })),

      deleteBrand: (id) =>
        set((s) => ({
          brands: s.brands.filter((b) => b.id !== id),
          activeBrandId: s.activeBrandId === id
            ? (s.brands.find((b) => b.id !== id)?.id ?? null)
            : s.activeBrandId,
        })),

      setActiveBrand: (id) => set({ activeBrandId: id }),

      getActiveBrand: () => {
        const { brands, activeBrandId } = get();
        return brands.find((b) => b.id === activeBrandId) ?? null;
      },

      // ── Posts ────────────────────────────────────────────────────────────
      posts: [],

      addPost: (post) => set((s) => ({ posts: [...s.posts, post] })),

      updatePost: (id, updates) =>
        set((s) => ({
          posts: s.posts.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),

      deletePost: (id) =>
        set((s) => ({ posts: s.posts.filter((p) => p.id !== id) })),

      getPostsByBrand: (brandId) => get().posts.filter((p) => p.brandId === brandId),

      // ── Automation ───────────────────────────────────────────────────────
      automationRules: [],

      addRule: (rule) => set((s) => ({ automationRules: [...s.automationRules, rule] })),

      updateRule: (id, updates) =>
        set((s) => ({
          automationRules: s.automationRules.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        })),

      deleteRule: (id) =>
        set((s) => ({ automationRules: s.automationRules.filter((r) => r.id !== id) })),

      getRulesByBrand: (brandId) =>
        get().automationRules.filter((r) => r.brandId === brandId),

      // ── UI ───────────────────────────────────────────────────────────────
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
    }),
    {
      name: "brandly-store",
      // Only persist data, not UI state
      partialize: (s) => ({
        brands: s.brands,
        activeBrandId: s.activeBrandId,
        posts: s.posts,
        automationRules: s.automationRules,
      }),
    }
  )
);
