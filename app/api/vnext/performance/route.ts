import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPerformanceOverview, recordPerformanceSnapshot, evaluateMeasurementEligibility } from "@/lib/piltover/vnext/measurement-engine";
import { ingestProviderMetricBatch, syncFreshness } from "@/lib/piltover/vnext/live-data-engine";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const data = await getPerformanceOverview(db, { entityType: req.nextUrl.searchParams.get("entityType") || undefined });
  const periods = new Set(data.snapshots.map((row) => row.period));
  const channels = new Set(data.snapshots.filter((row) => row.entityType === "channel").map((row) => row.entityId));
  const eligibility = evaluateMeasurementEligibility({
    observationCount: data.snapshots.length, distinctPeriods: periods.size,
    experimentCount: data.experiments.filter((row) => row.status === "COMPLETED").length,
    channelCount: channels.size,
    hasSpend: data.snapshots.some((row) => JSON.stringify(row.metrics).includes('"spend"')),
    hasOutcome: data.snapshots.some((row) => /conversion|revenue|lead/i.test(JSON.stringify(row.metrics))),
  });
  const tenant = await resolveLocalTenant(db);
  const syncStates = await db.dataSyncState.findMany({
    where: { organizationId: tenant.organizationId, brandId: tenant.brandId },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({
    ok: true,
    data: { ...data, eligibility, syncStates: syncStates.map((row) => ({ ...row, freshness: syncFreshness(row) })) },
  });
}
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = body?.action === "ingestProviderMetrics"
      ? await ingestProviderMetricBatch(db, body.input)
      : await recordPerformanceSnapshot(db, body.input ?? body);
    return NextResponse.json({ ok: true, data });
  }
  catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "PERFORMANCE_FAILED" }, { status: 400 }); }
}
