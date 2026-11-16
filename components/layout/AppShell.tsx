"use client";
import { useEffect } from "react";
import Sidebar, { MobileNav } from "@/components/layout/Sidebar";
import ImportLocalData from "@/components/layout/ImportLocalData";
import { Button, Spinner } from "@/components/ui";
import { useStore } from "@/lib/store";

export default function AppShell({ children }: { children: React.ReactNode }) {
  // Brands, posts and rules load from the database once per visit.
  // Pages render after that, so they never flash "No brand selected".
  const { hydrated, loadError, hydrate, syncError, clearSyncError } = useStore();
  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        {loadError ? (
          <div className="max-w-sm text-center space-y-3 px-4">
            <p className="text-sm text-text">{loadError}</p>
            <Button size="sm" variant="secondary" onClick={() => hydrate()}>
              Try again
            </Button>
          </div>
        ) : (
          <Spinner size={20} />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden pb-16 md:pb-0">
        {syncError && (
          <div role="alert" className="mx-4 mt-4 md:mx-8 rounded-xl border border-error/30 bg-error/5 px-4 py-2.5 text-sm text-error flex items-center gap-3">
            <span className="flex-1">{syncError}</span>
            <button className="text-xs underline" onClick={clearSyncError}>
              Dismiss
            </button>
          </div>
        )}
        <ImportLocalData />
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
