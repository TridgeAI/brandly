import { NextResponse } from "next/server";
import { errorResponse, requireSession } from "@/lib/db/session";
import { BRAND_SELECT, POST_SELECT, RULE_SELECT, brandFromRow, postFromRow, ruleFromRow, type BrandRow, type PostRow, type RuleRow } from "@/lib/db/mappers";

// Everything the app needs on load: account, workspace, brands (current version), posts, rules.
export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return NextResponse.json({ error: "Supabase isn't configured. Add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local." }, { status: 503 });
  }
  try {
    const s = await requireSession();
    const [ws, profile, brands, posts, rules] = await Promise.all([
      s.db.from("workspaces").select("id, name, plan, data_training_opt_in").eq("id", s.workspaceId).single(),
      s.db.from("profiles").select("full_name, email").eq("id", s.userId).maybeSingle(),
      s.db.from("brands").select(BRAND_SELECT).eq("workspace_id", s.workspaceId).is("archived_at", null).order("created_at"),
      s.db.from("posts").select(POST_SELECT).eq("workspace_id", s.workspaceId).neq("status", "discarded").order("scheduled_at"),
      s.db.from("automation_rules").select(RULE_SELECT).eq("workspace_id", s.workspaceId).order("created_at"),
    ]);
    for (const r of [ws, brands, posts, rules]) if (r.error) throw r.error;
    return NextResponse.json({
      user: { id: s.userId, email: profile.data?.email ?? s.email, name: profile.data?.full_name ?? null },
      workspace: ws.data,
      brands: (brands.data as unknown as BrandRow[]).map(brandFromRow).filter(Boolean),
      posts: (posts.data as unknown as PostRow[]).map(postFromRow),
      rules: (rules.data as unknown as RuleRow[]).map(ruleFromRow),
    });
  } catch (err) {
    return errorResponse(err, "bootstrap");
  }
}
