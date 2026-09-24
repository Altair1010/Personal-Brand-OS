import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { stableHash } from "@/lib/piltover/shared/contracts/stable-json";
import { captureEvidence } from "@/lib/piltover/vnext/evidence-service";
import { deriveMetrics, ensureMetricDefinitions } from "@/lib/piltover/vnext/measurement-engine";

const json = (value: unknown) => value as Prisma.InputJsonValue;

export type ProviderMetricFact = {
  metricKey: string;
  value: number;
  period: string;
  observedAt: Date;
  raw?: unknown;
};

export type ProviderMetricBatch = {
  organizationId: string;
  workspaceId?: string | null;
  brandId?: string | null;
  provider: string;
  providerAccountRef: string;
  providerResourceRef?: string | null;
  providerEntityRef: string;
  facts: ProviderMetricFact[];
  cadenceMinutes?: number;
  connectionId?: string | null;
  resourceId?: string | null;
  dataset?: string;
  windowStart?: Date | null;
  windowEnd?: Date | null;
};

export async function resolveProviderPostLineage(
  db: PrismaClient,
  input: { organizationId: string; brandId?: string | null; providerEntityRef: string },
) {
  const job = await db.publishingJob.findFirst({
    where: {
      organizationId: input.organizationId,
      ...(input.brandId ? { brandId: input.brandId } : {}),
      providerPostId: input.providerEntityRef,
    },
  });
  if (!job) return { attributionStatus: "UNLINKED" as const, lineage: null, entityType: "provider_post", entityId: input.providerEntityRef };

  const variant = await db.channelVariant.findUnique({ where: { id: job.contentVariantId } });
  const master = variant ? await db.contentMaster.findUnique({ where: { id: variant.contentMasterId } }) : null;
  const brief = master ? await db.contentBrief.findUnique({ where: { id: master.contentBriefId } }) : null;

  const explicit = brief?.campaignId ? await db.marketingCampaign.findFirst({
    where: {
      id: brief.campaignId,
      organizationId: job.organizationId,
      brandId: job.brandId,
    },
  }) : null;

  const lineage = {
    publishingJobId: job.id,
    providerPostId: job.providerPostId,
    channelVariantId: variant?.id ?? null,
    contentMasterId: master?.id ?? null,
    contentBriefId: brief?.id ?? null,
    campaignId: explicit?.id ?? brief?.campaignId ?? null,
    imcPlanId: explicit?.imcPlanId ?? null,
    strategyVersionId: explicit?.strategyVersionId ?? null,
  };
  return {
    attributionStatus: "LINKED" as const,
    lineage,
    entityType: "content",
    entityId: master?.id ?? variant?.id ?? job.id,
  };
}

export async function ingestProviderMetricBatch(db: PrismaClient, input: ProviderMetricBatch) {
  await ensureMetricDefinitions(db);
  if (!input.facts.length) return { snapshots: [], observations: [], attributionStatus: "UNLINKED" as const };
  for (const fact of input.facts) {
    if (!Number.isFinite(fact.value)) throw new Error("PROVIDER_METRIC_VALUE_INVALID");
  }

  const lineage = await resolveProviderPostLineage(db, {
    organizationId: input.organizationId,
    brandId: input.brandId,
    providerEntityRef: input.providerEntityRef,
  });
  const grouped = new Map<string, ProviderMetricFact[]>();
  for (const fact of input.facts) {
    const rows = grouped.get(fact.period) ?? [];
    rows.push(fact);
    grouped.set(fact.period, rows);
  }

  const snapshots = [];
  const observations = [];
  for (const [period, facts] of grouped) {
    const metrics = deriveMetrics(Object.fromEntries(facts.map((fact) => [fact.metricKey, fact.value])));
    const snapshotId = "provider:" + stableHash({
      provider: input.provider,
      account: input.providerAccountRef,
      resource: input.providerResourceRef ?? null,
      entity: input.providerEntityRef,
      period,
      metrics,
    });
    const snapshot = await db.performanceSnapshot.upsert({
      where: { id: snapshotId },
      update: {
        metrics: json(metrics), source: `provider:${input.provider}`, provider: input.provider,
        providerAccountRef: input.providerAccountRef, providerResourceRef: input.providerResourceRef ?? null,
        providerEntityRef: input.providerEntityRef,
        provenance: json({
          provider: input.provider, accountRef: input.providerAccountRef,
          resourceRef: input.providerResourceRef ?? null, entityRef: input.providerEntityRef,
        }),
        lineage: lineage.lineage ? json(lineage.lineage) : undefined,
        attributionStatus: lineage.attributionStatus,
        capturedAt: new Date(Math.max(...facts.map((fact) => fact.observedAt.getTime()))),
      },
      create: {
        id: snapshotId, organizationId: input.organizationId, workspaceId: input.workspaceId ?? null,
        brandId: input.brandId ?? null, entityType: lineage.entityType, entityId: lineage.entityId,
        period, metrics: json(metrics), source: `provider:${input.provider}`, provider: input.provider,
        providerAccountRef: input.providerAccountRef, providerResourceRef: input.providerResourceRef ?? null,
        providerEntityRef: input.providerEntityRef,
        provenance: json({
          provider: input.provider, accountRef: input.providerAccountRef,
          resourceRef: input.providerResourceRef ?? null, entityRef: input.providerEntityRef,
        }),
        lineage: lineage.lineage ? json(lineage.lineage) : undefined,
        attributionStatus: lineage.attributionStatus,
        capturedAt: new Date(Math.max(...facts.map((fact) => fact.observedAt.getTime()))),
      },
    });
    snapshots.push(snapshot);

    for (const fact of facts) {
      const sourceFingerprint = stableHash({
        provider: input.provider, account: input.providerAccountRef,
        resource: input.providerResourceRef ?? null, entity: input.providerEntityRef,
        metricKey: fact.metricKey, period: fact.period, observedAt: fact.observedAt.toISOString(), value: fact.value,
      });
      const observation = await db.providerMetricObservation.upsert({
        where: { sourceFingerprint },
        update: { performanceSnapshotId: snapshot.id },
        create: {
          id: randomUUID(), organizationId: input.organizationId, workspaceId: input.workspaceId ?? null,
          brandId: input.brandId ?? null, provider: input.provider, providerAccountRef: input.providerAccountRef,
          providerResourceRef: input.providerResourceRef ?? null, providerEntityRef: input.providerEntityRef,
          metricKey: fact.metricKey, numericValue: fact.value, period: fact.period, observedAt: fact.observedAt,
          sourceFingerprint, raw: fact.raw === undefined ? undefined : json(fact.raw), performanceSnapshotId: snapshot.id,
        },
      });
      observations.push(observation);
    }

    await captureEvidence(db, {
      organizationId: input.organizationId, brandId: input.brandId ?? null,
      sourceType: "PROVIDER_PERFORMANCE", sourceRef: `performance:${snapshot.id}`,
      content: { metrics, period, providerEntityRef: input.providerEntityRef, attributionStatus: lineage.attributionStatus },
      confidence: "provider-observed", freshness: "current", capturedAt: snapshot.capturedAt,
      metadata: {
        performanceSnapshotId: snapshot.id, provider: input.provider, providerAccountRef: input.providerAccountRef,
        providerResourceRef: input.providerResourceRef ?? null, lineage: lineage.lineage,
      },
    });
  }

  await markSyncSuccess(db, {
    organizationId: input.organizationId, workspaceId: input.workspaceId ?? null, brandId: input.brandId ?? null,
    provider: input.provider, connectionId: input.connectionId ?? null, resourceId: input.resourceId ?? null,
    dataset: input.dataset ?? "performance", cadenceMinutes: input.cadenceMinutes ?? 1440,
    windowStart: input.windowStart ?? null, windowEnd: input.windowEnd ?? null,
  });
  return { snapshots, observations, attributionStatus: lineage.attributionStatus, lineage: lineage.lineage };
}

export async function markSyncSuccess(db: PrismaClient, input: {
  organizationId: string; workspaceId?: string | null; brandId?: string | null; provider: string;
  connectionId?: string | null; resourceId?: string | null; dataset: string; cadenceMinutes?: number;
  windowStart?: Date | null; windowEnd?: Date | null; now?: Date;
}) {
  const now = input.now ?? new Date();
  const cadenceMinutes = input.cadenceMinutes ?? 1440;
  return db.dataSyncState.upsert({
    where: { organizationId_brandId_provider_connectionId_resourceId_dataset: {
      organizationId: input.organizationId, brandId: input.brandId ?? "", provider: input.provider,
      connectionId: input.connectionId ?? "", resourceId: input.resourceId ?? "", dataset: input.dataset,
    }},
    update: {
      status: "HEALTHY", lastAttemptAt: now, lastSuccessfulAt: now,
      expectedNextAt: new Date(now.getTime() + cadenceMinutes * 60_000),
      windowStart: input.windowStart ?? null, windowEnd: input.windowEnd ?? null,
      missingWindows: json([]), lastErrorCode: null, lastErrorMessage: null,
    },
    create: {
      id: randomUUID(), organizationId: input.organizationId, workspaceId: input.workspaceId ?? null,
      brandId: input.brandId ?? "", provider: input.provider, connectionId: input.connectionId ?? "",
      resourceId: input.resourceId ?? "", dataset: input.dataset, cadenceMinutes, status: "HEALTHY",
      lastAttemptAt: now, lastSuccessfulAt: now, expectedNextAt: new Date(now.getTime() + cadenceMinutes * 60_000),
      windowStart: input.windowStart ?? null, windowEnd: input.windowEnd ?? null, missingWindows: json([]),
    },
  });
}

export async function markSyncFailure(db: PrismaClient, input: {
  organizationId: string; workspaceId?: string | null; brandId?: string | null; provider: string;
  connectionId?: string | null; resourceId?: string | null; dataset: string; cadenceMinutes?: number;
  errorCode: string; errorMessage: string; missingWindows?: unknown[]; now?: Date;
}) {
  const now = input.now ?? new Date();
  const cadenceMinutes = input.cadenceMinutes ?? 1440;
  return db.dataSyncState.upsert({
    where: { organizationId_brandId_provider_connectionId_resourceId_dataset: {
      organizationId: input.organizationId, brandId: input.brandId ?? "", provider: input.provider,
      connectionId: input.connectionId ?? "", resourceId: input.resourceId ?? "", dataset: input.dataset,
    }},
    update: {
      status: "DEGRADED", lastAttemptAt: now, cadenceMinutes, lastErrorCode: input.errorCode,
      lastErrorMessage: input.errorMessage, missingWindows: json(input.missingWindows ?? []),
    },
    create: {
      id: randomUUID(), organizationId: input.organizationId, workspaceId: input.workspaceId ?? null,
      brandId: input.brandId ?? "", provider: input.provider, connectionId: input.connectionId ?? "",
      resourceId: input.resourceId ?? "", dataset: input.dataset, cadenceMinutes, status: "DEGRADED",
      lastAttemptAt: now, missingWindows: json(input.missingWindows ?? []),
      lastErrorCode: input.errorCode, lastErrorMessage: input.errorMessage,
    },
  });
}

export function syncFreshness(row: {
  status: string; expectedNextAt: Date | null; lastSuccessfulAt: Date | null; lastErrorCode: string | null;
}, now = new Date()) {
  if (row.status === "DEGRADED" || row.lastErrorCode) return "DEGRADED";
  if (!row.lastSuccessfulAt) return "NEVER_SYNCED";
  if (row.expectedNextAt && row.expectedNextAt < now) return "STALE";
  return "FRESH";
}
