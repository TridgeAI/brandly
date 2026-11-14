"use client";
import { createBrowserClient } from "@supabase/ssr";

/** Browser client: uses the publishable key; Row Level Security limits what it can read. */
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
}
