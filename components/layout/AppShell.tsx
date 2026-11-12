"use client";
import { useEffect, useState } from "react";
import Sidebar, { MobileNav } from "@/components/layout/Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  // Brands, posts and rules live in localStorage (Zustand persist), which the server can't see.
  // Render the app only after mounting in the browser so server and client HTML match
  // (avoids the hydration error and the brief "No brand selected" flash).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="flex h-screen overflow-hidden bg-bg" />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden pb-16 md:pb-0">{children}</main>
      <MobileNav />
    </div>
  );
}
