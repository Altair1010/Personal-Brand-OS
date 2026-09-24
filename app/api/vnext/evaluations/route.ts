import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { persistEvaluationRun } from "@/lib/piltover/vnext/evaluation-service";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const tenant = await resolveLocalTenant(db);
  const data = await db.evaluationRun.findMany({
    where: {
      organizationId: tenant.organizationId,
      OR: [{ brandId: tenant.brandId }, { brandId: null }],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ ok: true, data });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "BODY_REQUIRED" }, { status: 400 });
  }
  try {
    const record = body as Record<string, unknown>;
    const subjectRef = String(record.subjectRef || "").trim();
    const score = Number(record.score);
    if (!subjectRef) throw new Error("SUBJECT_REF_REQUIRED");
    if (!Number.isFinite(score) || score < 0 || score > 1) throw new Error("INVALID_EVAL_SCORE");
    const data = await persistEvaluationRun(db, {
      subjectType: String(record.subjectType || "ENGINE"),
      subjectRef,
      suiteRef: typeof record.suiteRef === "string" ? record.suiteRef : null,
      baselineRef: typeof record.baselineRef === "string" ? record.baselineRef : null,
      candidateRef: typeof record.candidateRef === "string" ? record.candidateRef : null,
      score,
      baselineScore: typeof record.baselineScore === "number" ? record.baselineScore : null,
      tolerance: typeof record.tolerance === "number" ? record.tolerance : 0,
      result: record.result ?? {},
    });
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "EVALUATION_FAILED" },
      { status: 400 },
    );
  }
}
