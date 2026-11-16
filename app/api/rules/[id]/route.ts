import { NextRequest, NextResponse } from "next/server";
import { errorResponse, requireSession } from "@/lib/db/session";
import { ruleToRow } from "@/lib/db/mappers";
import type { AutomationRule } from "@/lib/types";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const row = ruleToRow((await req.json()) as Partial<AutomationRule>);
    if (!Object.keys(row).length) return NextResponse.json({ ok: true });
    const s = await requireSession();
    const { error } = await s.db.from("automation_rules").update(row).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, "rule update");
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const s = await requireSession();
    const { error } = await s.db.from("automation_rules").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, "rule delete");
  }
}
