import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { markRecommendationApplied, proposeRecommendation, reviewRecommendation, synthesizeExperimentRecommendation } from "@/lib/piltover/vnext/learning-engine";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";
import { resolveEvidenceRefs } from "@/lib/piltover/vnext/evidence-service";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET() {
  const tenant = await resolveLocalTenant(db);
  const rows = await db.recommendation.findMany({
    where: { organizationId: tenant.organizationId, brandId: tenant.brandId },
    orderBy: { updatedAt: "desc" },
  });
  const data = await Promise.all(rows.map(async (row) => {
    const refs = Array.isArray(row.evidenceRefs) ? row.evidenceRefs.filter((x): x is string => typeof x === "string") : [];
    return { ...row, resolvedEvidence: await resolveEvidenceRefs(db, refs) };
  }));
  return NextResponse.json({ ok: true, data });
}
export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    const data = body.action === "review" ? await reviewRecommendation(db, body.id, body.decision)
      : body.action === "apply" ? await markRecommendationApplied(db, body.id)
      : body.action === "fromExperiment" ? await synthesizeExperimentRecommendation(db, body.experimentId)
      : await proposeRecommendation(db, body.input ?? body);
    return NextResponse.json({ ok: true, data });
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "RECOMMENDATION_FAILED" }, { status: 400 }); }
}
