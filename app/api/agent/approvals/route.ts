import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSupabaseConfigOrThrow } from "@/lib/supabase-config";
import { PrismaApproval } from "@/lib/piltover/modules/approvals/infrastructure/prisma-approval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function actorFromRequest(req: NextRequest) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new Error("AUTH_REQUIRED");
  const { url, anonKey } = getSupabaseConfigOrThrow();
  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error("AUTH_INVALID");
  return { provider: "supabase", subject: data.user.id } as const;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as null | {
    approvalId?: string;
    decision?: "APPROVED" | "REJECTED";
  };
  if (!body?.approvalId || !body.decision) {
    return NextResponse.json({ ok: false, error: "APPROVAL_AND_DECISION_REQUIRED" }, { status: 400 });
  }
  try {
    const actor = await actorFromRequest(req);
    const record = await db.approvalRequest.findUnique({ where: { id: body.approvalId } });
    if (!record) return NextResponse.json({ ok: false, error: "APPROVAL_NOT_FOUND" }, { status: 404 });
    if (record.payloadSnapshot === null) {
      return NextResponse.json({ ok: false, error: "APPROVAL_PAYLOAD_SNAPSHOT_REQUIRED" }, { status: 409 });
    }
    const service = new PrismaApproval(db);
    const decided = await service.decide(actor, record.id, body.decision, record.payloadSnapshot);
    if (body.decision === "APPROVED") {
      await service.consume(
        actor,
        record.id,
        { actionType: record.actionType, targetRef: record.targetRef, payload: record.payloadSnapshot },
        record.oneTimeNonce ?? undefined,
      );
    }
    return NextResponse.json({ ok: true, data: decided });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "APPROVAL_DECISION_FAILED" },
      { status: 403 },
    );
  }
}
