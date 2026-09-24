import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";
import { getBrandIsolationSnapshot, getOperatorActionHistory, validateTenantScope } from "@/lib/piltover/vnext/governance-service";
import { exportBetaRecovery } from "@/lib/piltover/vnext/beta-recovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function scopeFrom(req: NextRequest) {
  const fallback = await resolveLocalTenant(db);
  const brandId = req.nextUrl.searchParams.get("brandId") || fallback.brandId;
  const brand = await db.brand.findFirst({ where: { id: brandId, organizationId: fallback.organizationId, status: "ACTIVE" } });
  if (!brand) throw new Error("BRAND_SCOPE_FORBIDDEN");
  const scope = { organizationId: fallback.organizationId, workspaceId: brand.workspaceId, brandId: brand.id };
  await validateTenantScope(db, scope);
  return scope;
}

export async function GET(req: NextRequest) {
  try {
    const scope = await scopeFrom(req);
    const view = req.nextUrl.searchParams.get("view") || "overview";
    if (view === "history") return NextResponse.json({ ok: true, data: await getOperatorActionHistory(db, scope) });
    if (view === "recovery") return NextResponse.json({ ok: true, data: await exportBetaRecovery(db, scope) });
    const [isolation, connections, syncStates, pendingApprovals, failedJobs] = await Promise.all([
      getBrandIsolationSnapshot(db, scope),
      db.providerConnection.findMany({ where: { ...scope }, select: { id: true, provider: true, externalAccountId: true, externalAccountName: true, status: true, health: true, lastErrorCode: true, lastErrorMessage: true } }),
      db.dataSyncState.findMany({ where: { organizationId: scope.organizationId, brandId: scope.brandId }, orderBy: { updatedAt: "desc" } }),
      db.approvalRequest.findMany({ where: { ...scope, status: "PENDING" }, orderBy: { createdAt: "desc" } }),
      db.publishingJob.findMany({ where: { ...scope, status: { in: ["FAILED", "BLOCKED", "RECONCILIATION_REQUIRED"] } }, orderBy: { updatedAt: "desc" } }),
    ]);
    return NextResponse.json({ ok: true, data: { scope, isolation, connections, syncStates, pendingApprovals, failedJobs } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "GOVERNANCE_FAILED" }, { status: 403 });
  }
}
