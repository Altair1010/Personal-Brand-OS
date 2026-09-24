import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;
export type TenantScope = { organizationId: string; workspaceId: string; brandId: string };

export async function validateTenantScope(db: Db, scope: TenantScope) {
  const brand = await db.brand.findFirst({
    where: { id: scope.brandId, organizationId: scope.organizationId, workspaceId: scope.workspaceId, status: "ACTIVE" },
    select: { id: true, name: true, organizationId: true, workspaceId: true, status: true },
  });
  if (!brand) throw new Error("BRAND_SCOPE_FORBIDDEN");
  return brand;
}

export async function assertProviderTargetScope(db: Db, input: TenantScope & { connectionId: string; resourceId?: string }) {
  await validateTenantScope(db, input);
  const connection = await db.providerConnection.findFirst({
    where: {
      id: input.connectionId, organizationId: input.organizationId,
      workspaceId: input.workspaceId, brandId: input.brandId,
    },
  });
  if (!connection) throw new Error("PROVIDER_CONNECTION_SCOPE_FORBIDDEN");
  if (input.resourceId) {
    const resource = await db.providerResource.findFirst({
      where: { id: input.resourceId, connectionId: connection.id },
    });
    if (!resource) throw new Error("PROVIDER_RESOURCE_SCOPE_FORBIDDEN");
    return { connection, resource };
  }
  return { connection, resource: null };
}

export async function getOperatorActionHistory(db: PrismaClient, scope: TenantScope, take = 100) {
  await validateTenantScope(db, scope);
  const [audit, approvals, jobs] = await Promise.all([
    db.auditEntry.findMany({
      where: { organizationId: scope.organizationId },
      orderBy: { occurredAt: "desc" }, take: take * 3,
    }),
    db.approvalRequest.findMany({
      where: { organizationId: scope.organizationId, workspaceId: scope.workspaceId, brandId: scope.brandId },
      orderBy: { createdAt: "desc" }, take,
    }),
    db.publishingJob.findMany({
      where: { organizationId: scope.organizationId, brandId: scope.brandId },
      include: { deliveryAttempts: { orderBy: { startedAt: "desc" } } },
      orderBy: { createdAt: "desc" }, take,
    }),
  ]);
  const jobIds = new Set(jobs.map((job) => job.id));
  const approvalIds = new Set(approvals.map((approval) => approval.id));
  const scopedAudit = audit.filter((entry) => {
    const metadata = entry.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata)
      ? entry.metadata as Record<string, unknown> : {};
    return metadata.brandId === scope.brandId || entry.targetId === scope.brandId ||
      jobIds.has(entry.targetId) || approvalIds.has(entry.targetId);
  }).slice(0, take);
  return { scope, audit: scopedAudit, approvals, jobs };
}

export async function getBrandIsolationSnapshot(db: PrismaClient, scope: TenantScope) {
  await validateTenantScope(db, scope);
  const where = { organizationId: scope.organizationId, brandId: scope.brandId };
  const [connections, contexts, threads, campaigns, approvals, metrics, evidence, recommendations, syncStates] = await Promise.all([
    db.providerConnection.count({ where: { ...where, workspaceId: scope.workspaceId } }),
    db.marketingProjectContext.count({ where: { ...where, workspaceId: scope.workspaceId } }),
    db.agentThread.count({ where: { ...where, workspaceId: scope.workspaceId } }),
    db.marketingCampaign.count({ where }),
    db.approvalRequest.count({ where: { ...where, workspaceId: scope.workspaceId } }),
    db.performanceSnapshot.count({ where }),
    db.evidence.count({ where }),
    db.recommendation.count({ where }),
    db.dataSyncState.count({ where }),
  ]);
  return { scope, counts: { connections, contexts, threads, campaigns, approvals, metrics, evidence, recommendations, syncStates } };
}
