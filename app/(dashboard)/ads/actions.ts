"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { resolveLocalPiltoverScope } from "@/lib/piltover/h1/local-scope";

const campaignSchema = z.object({
  name: z.string().min(2),
  objective: z.string().min(2),
  audience: z.string().min(2),
  budgetAmount: z.coerce.number().nonnegative(),
  bidIntent: z.string().optional(),
  creativeDraftId: z.string().min(1),
});

const statusSchema = z.enum(["DRAFT", "READY", "RUNNING", "PAUSED", "COMPLETED"]);

const metricKeys = ["spend", "impressions", "clicks", "conversions", "revenue"] as const;

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function getAdsData() {
  const scope = await resolveLocalPiltoverScope();

  const [drafts, campaigns, insights] = await Promise.all([
    db.contentDraft.findMany({
      where: {
        userId: scope.userId,
        organizationId: scope.organizationId,
        brandId: scope.brandId,
        post: { isNot: null },
      },
      select: { id: true, topic: true, contentIdea: { select: { title: true } } },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
    db.adCampaign.findMany({
      where: { organizationId: scope.organizationId, brandId: scope.brandId },
      include: { metrics: { orderBy: { observedAt: "desc" } } },
      orderBy: { updatedAt: "desc" },
    }),
    db.performanceInsight.findMany({
      where: {
        userId: scope.userId,
        organizationId: scope.organizationId,
        brandId: scope.brandId,
        scope: "ads",
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return {
    scope,
    approvedDrafts: drafts.map((draft) => ({
      id: draft.id,
      title: draft.contentIdea?.title ?? draft.topic ?? "Approved creative",
    })),
    campaigns: campaigns.map((campaign) => ({
      ...campaign,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
      metrics: campaign.metrics.map((metric) => ({
        ...metric,
        observedAt: metric.observedAt.toISOString(),
        createdAt: metric.createdAt.toISOString(),
        updatedAt: metric.updatedAt.toISOString(),
      })),
    })),
    insights: insights.map((insight) => ({
      id: insight.id,
      refId: insight.refId,
      finding: insight.finding,
      evidence: insight.evidence,
      recommendation: insight.recommendation,
      confidence: insight.confidence,
      createdAt: insight.createdAt.toISOString(),
    })),
  };
}

export async function createAdCampaign(formData: FormData): Promise<void> {
  const scope = await resolveLocalPiltoverScope();
  const parsed = campaignSchema.safeParse({
    name: text(formData, "name"),
    objective: text(formData, "objective"),
    audience: text(formData, "audience"),
    budgetAmount: formData.get("budgetAmount"),
    bidIntent: text(formData, "bidIntent") || undefined,
    creativeDraftId: text(formData, "creativeDraftId"),
  });

  if (!parsed.success) throw new Error("ADS_CAMPAIGN_INPUT_INVALID");

  const creative = await db.contentDraft.findFirst({
    where: {
      id: parsed.data.creativeDraftId,
      userId: scope.userId,
      organizationId: scope.organizationId,
      brandId: scope.brandId,
      post: { isNot: null },
    },
    select: { id: true },
  });
  if (!creative) throw new Error("ADS_APPROVED_CREATIVE_REQUIRED");

  const appState = await db.appState.findUnique({
    where: { id: "singleton" },
    select: { activeGoalId: true, activeStrategyId: true },
  });

  await db.adCampaign.create({
    data: {
      organizationId: scope.organizationId,
      brandId: scope.brandId,
      goalId: appState?.activeGoalId ?? null,
      strategyId: appState?.activeStrategyId ?? null,
      creativeDraftId: creative.id,
      name: parsed.data.name,
      objective: parsed.data.objective,
      audience: { summary: parsed.data.audience },
      budgetAmount: parsed.data.budgetAmount,
      bidIntent: parsed.data.bidIntent ?? null,
      status: "READY",
      deliveryMode: "INTERNAL_DEMO",
    },
  });

  revalidatePath("/ads");
  revalidatePath("/");
}

export async function setAdCampaignStatus(formData: FormData): Promise<void> {
  const scope = await resolveLocalPiltoverScope();
  const campaignId = text(formData, "campaignId");
  const status = statusSchema.parse(text(formData, "status"));

  const result = await db.adCampaign.updateMany({
    where: {
      id: campaignId,
      organizationId: scope.organizationId,
      brandId: scope.brandId,
    },
    data: { status },
  });

  if (result.count !== 1) throw new Error("ADS_CAMPAIGN_NOT_FOUND");
  revalidatePath("/ads");
  revalidatePath("/");
}

export async function saveAdMetrics(formData: FormData): Promise<void> {
  const scope = await resolveLocalPiltoverScope();
  const campaignId = text(formData, "campaignId");
  const campaign = await db.adCampaign.findFirst({
    where: {
      id: campaignId,
      organizationId: scope.organizationId,
      brandId: scope.brandId,
    },
    select: { id: true },
  });
  if (!campaign) throw new Error("ADS_CAMPAIGN_NOT_FOUND");

  const observedAt = new Date();
  const rows = metricKeys.flatMap((metricKey) => {
    const raw = text(formData, metricKey);
    if (raw === "") return [];
    const numericValue = Number(raw);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      throw new Error("ADS_METRIC_INVALID:" + metricKey);
    }
    return [{ metricKey, numericValue }];
  });

  if (rows.length === 0) throw new Error("ADS_METRICS_EMPTY");

  await db.adMetricObservation.createMany({
    data: rows.map((row) => ({
      campaignId,
      organizationId: scope.organizationId,
      brandId: scope.brandId,
      metricKey: row.metricKey,
      numericValue: row.numericValue,
      observedAt,
      source: "MANUAL",
      provenance: {
        mode: "H1_INTERNAL_DEMO",
        enteredBy: scope.userId,
      },
    })),
  });

  revalidatePath("/ads");
}

function latestMetric(
  metrics: { metricKey: string; numericValue: number; observedAt: Date }[],
  key: string,
): number {
  return metrics
    .filter((metric) => metric.metricKey === key)
    .sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime())[0]
    ?.numericValue ?? 0;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function generateAdInsight(formData: FormData): Promise<void> {
  const scope = await resolveLocalPiltoverScope();
  const campaignId = text(formData, "campaignId");
  const campaign = await db.adCampaign.findFirst({
    where: {
      id: campaignId,
      organizationId: scope.organizationId,
      brandId: scope.brandId,
    },
    include: { metrics: true },
  });
  if (!campaign) throw new Error("ADS_CAMPAIGN_NOT_FOUND");

  const spend = latestMetric(campaign.metrics, "spend");
  const impressions = latestMetric(campaign.metrics, "impressions");
  const clicks = latestMetric(campaign.metrics, "clicks");
  const conversions = latestMetric(campaign.metrics, "conversions");
  const revenue = latestMetric(campaign.metrics, "revenue");

  const ctr = impressions > 0 ? round((clicks / impressions) * 100) : 0;
  const cpc = clicks > 0 ? round(spend / clicks) : 0;
  const cpa = conversions > 0 ? round(spend / conversions) : 0;
  const roas = spend > 0 ? round(revenue / spend) : 0;

  const finding =
    impressions > 0
      ? `Paid campaign "${campaign.name}" has CTR ${ctr}% with ${clicks} clicks from ${impressions} impressions.`
      : `Paid campaign "${campaign.name}" does not yet have impression evidence.`;

  const recommendation =
    conversions > 0
      ? `Use CPA ${cpa} and ROAS ${roas} as evidence before changing the next strategy iteration.`
      : "Collect conversion evidence before scaling budget or changing the strategy.";

  await db.performanceInsight.create({
    data: {
      userId: scope.userId,
      organizationId: scope.organizationId,
      brandId: scope.brandId,
      scope: "ads",
      refId: campaign.id,
      period: "H1 demo",
      finding,
      evidence: {
        text: `spend=${spend}; impressions=${impressions}; clicks=${clicks}; conversions=${conversions}; revenue=${revenue}; ctr=${ctr}; cpc=${cpc}; cpa=${cpa}; roas=${roas}`,
        campaignId: campaign.id,
        deliveryMode: campaign.deliveryMode,
      },
      recommendation,
      confidence: impressions >= 100 ? "normal" : "low",
    },
  });

  revalidatePath("/ads");
  revalidatePath("/review");
  revalidatePath("/performance");
  revalidatePath("/");
}
