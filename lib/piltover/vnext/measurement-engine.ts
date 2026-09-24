import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";
import { captureEvidence } from "@/lib/piltover/vnext/evidence-service";

const json = (value: unknown) => value as Prisma.InputJsonValue;

export const DEFAULT_METRICS = [
  { key: "reach", name: "Reach", unit: "people", source: "observed", aggregation: "sum" },
  { key: "impressions", name: "Impressions", unit: "impressions", source: "observed", aggregation: "sum" },
  { key: "engagement", name: "Engagement", unit: "actions", source: "observed", aggregation: "sum" },
  { key: "engagement_rate", name: "Engagement rate", unit: "%", source: "derived", aggregation: "ratio", formula: "engagement / reach * 100" },
  { key: "clicks", name: "Clicks", unit: "clicks", source: "observed", aggregation: "sum" },
  { key: "ctr", name: "CTR", unit: "%", source: "derived", aggregation: "ratio", formula: "clicks / impressions * 100" },
  { key: "spend", name: "Spend", unit: "minor_currency", source: "observed", aggregation: "sum" },
  { key: "cpc", name: "CPC", unit: "minor_currency", source: "derived", aggregation: "ratio", formula: "spend / clicks" },
  { key: "conversions", name: "Conversions", unit: "conversions", source: "observed", aggregation: "sum" },
  { key: "conversion_value", name: "Conversion value", unit: "minor_currency", source: "observed", aggregation: "sum" },
  { key: "cpa", name: "CPA", unit: "minor_currency", source: "derived", aggregation: "ratio", formula: "spend / conversions" },
  { key: "roas", name: "ROAS", unit: "x", source: "derived", aggregation: "ratio", formula: "conversion_value / spend" },
] as const;

export async function ensureMetricDefinitions(db: PrismaClient) {
  for (const metric of DEFAULT_METRICS) {
    await db.metricDefinition.upsert({
      where: { key: metric.key },
      update: {
        name: metric.name,
        formula: "formula" in metric ? metric.formula : null,
        unit: metric.unit,
        source: metric.source,
        aggregation: metric.aggregation,
      },
      create: {
        id: `metric:${metric.key}`,
        key: metric.key,
        name: metric.name,
        formula: "formula" in metric ? metric.formula : null,
        unit: metric.unit,
        source: metric.source,
        aggregation: metric.aggregation,
      },
    });
  }
  return db.metricDefinition.findMany({ orderBy: { key: "asc" } });
}

export function deriveMetrics(metrics: Record<string, number | null | undefined>) {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(metrics)) {
    if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
  }
  const safeRatio = (a?: number, b?: number, factor = 1) =>
    typeof a === "number" && typeof b === "number" && b !== 0 ? (a / b) * factor : undefined;

  const engagementRate = safeRatio(out.engagement, out.reach, 100);
  const ctr = safeRatio(out.clicks, out.impressions, 100);
  const cpc = safeRatio(out.spend, out.clicks);
  const cpa = safeRatio(out.spend, out.conversions);
  const roas = safeRatio(out.conversion_value, out.spend);

  if (engagementRate !== undefined) out.engagement_rate = engagementRate;
  if (ctr !== undefined) out.ctr = ctr;
  if (cpc !== undefined) out.cpc = cpc;
  if (cpa !== undefined) out.cpa = cpa;
  if (roas !== undefined) out.roas = roas;
  return out;
}

export async function recordPerformanceSnapshot(db: PrismaClient, input: {
  entityType: "post" | "content" | "campaign" | "channel" | "audience" | "creative" | "experiment";
  entityId: string;
  period: string;
  metrics: Record<string, number | null | undefined>;
  source: string;
  capturedAt?: Date;
}) {
  await ensureMetricDefinitions(db);
  const tenant = await resolveLocalTenant(db);
  const derived = deriveMetrics(input.metrics);
  const snapshot = await db.performanceSnapshot.create({
    data: {
      id: randomUUID(),
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      brandId: tenant.brandId,
      entityType: input.entityType,
      entityId: input.entityId,
      period: input.period,
      metrics: json(derived),
      source: input.source,
      capturedAt: input.capturedAt ?? new Date(),
    },
  });
  await captureEvidence(db, {
    organizationId: tenant.organizationId,
    brandId: tenant.brandId,
    sourceType: "PERFORMANCE_SNAPSHOT",
    sourceRef: `performance:${snapshot.id}`,
    content: { entityType: snapshot.entityType, entityId: snapshot.entityId, period: snapshot.period, metrics: derived },
    confidence: input.source.toLowerCase().includes("manual") ? "reported" : "observed",
    freshness: "current",
    metadata: { source: input.source },
    capturedAt: snapshot.capturedAt,
  });
  return snapshot;
}

export async function syncCanonicalPerformanceFromLegacy(db: PrismaClient) {
  const tenant = await resolveLocalTenant(db);
  await ensureMetricDefinitions(db);

  const [organic, paid] = await Promise.all([
    db.metricSnapshot.findMany({
      where: {
        post: {
          organizationId: tenant.organizationId,
          brandId: tenant.brandId,
        },
      },
      orderBy: { capturedAt: "asc" },
    }),
    db.metaAdsMetricSnapshot.findMany({
      where: {
        organizationId: tenant.organizationId,
        brandId: tenant.brandId,
      },
      include: {
        metaAdsCampaign: { select: { marketingCampaignId: true } },
      },
      orderBy: { capturedAt: "asc" },
    }),
  ]);

  for (const row of organic) {
    const metrics = deriveMetrics({
      reach: row.reach,
      engagement: row.engagement,
      comments: row.comments,
      shares: row.shares,
      saves: row.saves,
    });
    await db.performanceSnapshot.upsert({
      where: { id: `legacy:organic:${row.id}` },
      update: {
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        brandId: tenant.brandId,
        period: row.capturedAt.toISOString().slice(0, 10),
        metrics: json(metrics),
        source: `legacy-organic:${row.source}`,
        capturedAt: row.capturedAt,
      },
      create: {
        id: `legacy:organic:${row.id}`,
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        brandId: tenant.brandId,
        entityType: "post",
        entityId: row.postId,
        period: row.capturedAt.toISOString().slice(0, 10),
        metrics: json(metrics),
        source: `legacy-organic:${row.source}`,
        capturedAt: row.capturedAt,
      },
    });
  }

  for (const row of paid) {
    const metrics = deriveMetrics({
      spend: row.spendMinor,
      impressions: row.impressions,
      reach: row.reach,
      clicks: row.clicks,
      conversions: row.conversions,
      conversion_value: row.conversionValueMinor,
    });
    await db.performanceSnapshot.upsert({
      where: { id: `legacy:meta:${row.id}` },
      update: {
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        brandId: tenant.brandId,
        entityId: row.metaAdsCampaign.marketingCampaignId,
        period: row.capturedAt.toISOString().slice(0, 10),
        metrics: json(metrics),
        source: `legacy-meta:${row.source}`,
        capturedAt: row.capturedAt,
      },
      create: {
        id: `legacy:meta:${row.id}`,
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        brandId: tenant.brandId,
        entityType: "campaign",
        entityId: row.metaAdsCampaign.marketingCampaignId,
        period: row.capturedAt.toISOString().slice(0, 10),
        metrics: json(metrics),
        source: `legacy-meta:${row.source}`,
        capturedAt: row.capturedAt,
      },
    });
  }

  return { organic: organic.length, paid: paid.length, synced: organic.length + paid.length };
}

export async function getPerformanceOverview(db: PrismaClient, input?: {
  entityType?: string;
  limit?: number;
}) {
  const tenant = await resolveLocalTenant(db);
  await syncCanonicalPerformanceFromLegacy(db);
  const [snapshots, campaigns, experiments] = await Promise.all([
    db.performanceSnapshot.findMany({
      where: {
        organizationId: tenant.organizationId,
        brandId: tenant.brandId,
        ...(input?.entityType ? { entityType: input.entityType } : {}),
      },
      orderBy: { capturedAt: "desc" },
      take: input?.limit ?? 100,
    }),
    db.marketingCampaign.findMany({
      where: { organizationId: tenant.organizationId, brandId: tenant.brandId },
      select: { id: true, name: true, status: true, objective: true },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    db.experiment.findMany({
      where: { organizationId: tenant.organizationId, brandId: tenant.brandId },
      select: { id: true, hypothesis: true, status: true, primaryMetric: true },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
  ]);

  const totals: Record<string, number> = {};
  for (const snapshot of snapshots) {
    const metrics = snapshot.metrics && typeof snapshot.metrics === "object" && !Array.isArray(snapshot.metrics)
      ? snapshot.metrics as Record<string, unknown>
      : {};
    for (const [key, value] of Object.entries(metrics)) {
      if (typeof value === "number" && Number.isFinite(value)) totals[key] = (totals[key] ?? 0) + value;
    }
  }

  return { snapshots, totals, campaigns, experiments };
}

export type MeasurementEligibility = {
  mode: "DESCRIPTIVE" | "EXPERIMENT" | "INCREMENTALITY" | "ATTRIBUTION" | "MMM";
  eligible: boolean;
  reasons: string[];
};

export function evaluateMeasurementEligibility(input: {
  observationCount: number;
  distinctPeriods: number;
  experimentCount: number;
  channelCount: number;
  hasSpend: boolean;
  hasOutcome: boolean;
}): MeasurementEligibility[] {
  return [
    { mode: "DESCRIPTIVE", eligible: input.observationCount > 0, reasons: input.observationCount > 0 ? [] : ["NO_OBSERVATIONS"] },
    { mode: "EXPERIMENT", eligible: input.experimentCount > 0, reasons: input.experimentCount > 0 ? [] : ["NO_EXPERIMENTS"] },
    { mode: "INCREMENTALITY", eligible: input.experimentCount > 0 && input.hasOutcome, reasons: [
      ...(input.experimentCount > 0 ? [] : ["NO_EXPERIMENTS"]),
      ...(input.hasOutcome ? [] : ["NO_OUTCOME_METRIC"]),
    ] },
    { mode: "ATTRIBUTION", eligible: input.hasOutcome && input.observationCount >= 20, reasons: [
      ...(input.hasOutcome ? [] : ["NO_OUTCOME_METRIC"]),
      ...(input.observationCount >= 20 ? [] : ["INSUFFICIENT_OBSERVATIONS"]),
    ] },
    { mode: "MMM", eligible: input.hasSpend && input.hasOutcome && input.channelCount >= 2 && input.distinctPeriods >= 52, reasons: [
      ...(input.hasSpend ? [] : ["NO_SPEND_SERIES"]),
      ...(input.hasOutcome ? [] : ["NO_OUTCOME_SERIES"]),
      ...(input.channelCount >= 2 ? [] : ["NEED_MULTIPLE_CHANNELS"]),
      ...(input.distinctPeriods >= 52 ? [] : ["NEED_AT_LEAST_52_PERIODS"]),
    ] },
  ];
}

export interface MeasurementProvider {
  id: string;
  run(input: { datasetRef: string; mode: string; options?: unknown }): Promise<unknown>;
}
