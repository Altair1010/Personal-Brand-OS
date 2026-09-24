import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createExperiment, transitionExperiment, completeExperiment } from "@/lib/piltover/vnext/experiment-engine";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET() {
  const tenant = await resolveLocalTenant(db);
  return NextResponse.json({ ok: true, data: await db.experiment.findMany({ where: { organizationId: tenant.organizationId, brandId: tenant.brandId }, orderBy: { updatedAt: "desc" } }) });
}
export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    const data = body.action === "transition" ? await transitionExperiment(db, body.id, body.status)
      : body.action === "complete" ? await completeExperiment(db, body)
      : await createExperiment(db, body.input ?? body);
    return NextResponse.json({ ok: true, data });
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "EXPERIMENT_FAILED" }, { status: 400 }); }
}
