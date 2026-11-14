import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const WORKSPACE_COOKIE = "brandly_ws";

export class AuthError extends Error {
  status = 401;
}

export type Db = Awaited<ReturnType<typeof createClient>>;

export interface Session {
  db: Db;
  userId: string;
  email?: string;
  workspaceId: string;
}

/** The signed-in user and their current workspace. Throws AuthError when signed out. */
export async function requireSession(): Promise<Session> {
  const db = await createClient();
  const { data } = await db.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) throw new AuthError("Please sign in.");

  const { data: memberships, error } = await db
    .from("workspace_members")
    .select("workspace_id, role, workspaces(personal, created_at)")
    .eq("user_id", claims.sub);
  if (error) throw error;
  if (!memberships?.length) throw new AuthError("No workspace found for this account.");

  const wanted = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  const chosen = memberships.find((m) => m.workspace_id === wanted) ?? memberships[0];
  return { db, userId: claims.sub, email: claims.email as string | undefined, workspaceId: chosen.workspace_id };
}

/** Same as requireSession, but resolves to null when Supabase isn't configured or the user is signed out. */
export async function optionalSession(): Promise<Session | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return null;
  try {
    return await requireSession();
  } catch {
    return null;
  }
}

/** Turns thrown errors into JSON responses for API routes. */
export function errorResponse(err: unknown, label: string) {
  if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 401 });
  const msg = err instanceof Error ? err.message : typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : String(err);
  console.error(`[${label}]`, err);
  return NextResponse.json({ error: msg }, { status: 500 });
}
