import type { Prisma, PrismaClient } from "@prisma/client";
import {
  assertDeliveryTransition,
  assertMetaAdsTransition,
  type DeliveryState,
  type H1PerformanceEvidence,
  type MetaAdsState,
} from "../domain/h1-spine";

type Db = PrismaClient | Prisma.TransactionClient;

export type TenantRef = {
  organizationId: string;
  workspaceId: string;
  brandId: string;
};

export class PrismaH1ProductSpine {
  constructor(private readonly db: Db) {}

  private async requireBrand(tenant: TenantRef): Promise<void> {
    const brand = await this.db.brand.findFirst({
      where: {
        id: tenant.brandId,
        workspaceId: tenant.workspaceId,
        organizationId: tenant.organizationId,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    if (!brand) throw new Error("TENANT_BRAND_NOT_ACTIVE");
  }
  async createCampaign(input: TenantRef & {
    name: string;
    objective: string;
    channelMode: "ORGANIC" | "PAID" | "MIXED";
    strategyVersionId?: string;
    imcPlanId?: string;
    audienceIds?: unknown[];
    channelIds?: unknown[];
    budget?: unknown;
    kpis?: unknown[];
    creativePlatform?: unknown;
    contentPlan?: unknown;
    experimentIds?: unknown[];
    startsAt?: Date;
    endsAt?: Date;
  }) {
    await this.requireBrand(input);
    if (input.strategyVersionId) {
      const version = await this.db.strategyVersion.findUnique({
        where: { id: input.strategyVersionId },
        include: { strategy: { select: { organizationId: true, brandId: true } } },
      });
      if (!version) throw new Error("STRATEGY_VERSION_NOT_FOUND");
      const s = version.strategy;
      if (s.organizationId !== input.organizationId || s.brandId !== input.brandId) {
        throw new Error("TENANT_ANCESTRY_MISMATCH");
      }
    }
    return this.db.marketingCampaign.create({
      data: {
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        brandId: input.brandId,
        strategyVersionId: input.strategyVersionId,
        imcPlanId: input.imcPlanId,
        name: input.name,
        objective: input.objective,
        channelMode: input.channelMode,
        audienceIds: input.audienceIds as Prisma.InputJsonValue | undefined,
        channelIds: input.channelIds as Prisma.InputJsonValue | undefined,
        budget: input.budget as Prisma.InputJsonValue | undefined,
        kpis: input.kpis as Prisma.InputJsonValue | undefined,
        creativePlatform: input.creativePlatform as Prisma.InputJsonValue | undefined,
        contentPlan: input.contentPlan as Prisma.InputJsonValue | undefined,
        experimentIds: input.experimentIds as Prisma.InputJsonValue | undefined,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      },
    });
  }
  async scheduleOrganicPost(input: TenantRef & {
    postId: string;
    campaignId?: string;
    scheduledAt: Date;
  }) {
    await this.requireBrand(input);
    const post = await this.db.post.findUnique({ where: { id: input.postId } });
    if (!post) throw new Error("POST_NOT_FOUND");
    if (post.organizationId !== input.organizationId || post.brandId !== input.brandId) {
      throw new Error("TENANT_ANCESTRY_MISMATCH");
    }
    if (input.campaignId) {
      const campaign = await this.db.marketingCampaign.findUnique({ where: { id: input.campaignId } });
      if (!campaign) throw new Error("CAMPAIGN_NOT_FOUND");
      if (campaign.organizationId !== input.organizationId || campaign.brandId !== input.brandId) {
        throw new Error("TENANT_ANCESTRY_MISMATCH");
      }
    }
    const existing = await this.db.contentDelivery.findUnique({
      where: { postId: input.postId },
    });
    if (existing) {
      assertDeliveryTransition(existing.state as DeliveryState, "SCHEDULED");
      return this.db.contentDelivery.update({
        where: { postId: input.postId },
        data: {
          campaignId: input.campaignId,
          state: "SCHEDULED",
          scheduledAt: input.scheduledAt,
          lastError: null,
        },
      });
    }
    return this.db.contentDelivery.create({
      data: {
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        brandId: input.brandId,
        campaignId: input.campaignId,
        postId: input.postId,
        state: "SCHEDULED",
        scheduledAt: input.scheduledAt,
      },
    });
  }
  async transitionDelivery(postId: string, next: DeliveryState, details?: {
    publishedAt?: Date;
    externalRef?: string;
    lastError?: string;
  }) {
    const current = await this.db.contentDelivery.findUnique({ where: { postId } });
    if (!current) throw new Error("DELIVERY_NOT_FOUND");
    assertDeliveryTransition(current.state as DeliveryState, next);
    const delivery = await this.db.contentDelivery.update({
      where: { postId },
      data: {
        state: next,
        publishedAt: details?.publishedAt,
        externalRef: details?.externalRef,
        lastError: details?.lastError,
      },
    });
    if (next === "PUBLISHED") {
      await this.db.post.update({
        where: { id: postId },
        data: { status: "posted", publishedAt: details?.publishedAt ?? new Date() },
      });
    }
    return delivery;
  }

  async createMetaAdsCampaign(input: TenantRef & {
    marketingCampaignId: string;
    creativePostId?: string;
    name: string;
    objective: string;
    budgetMinor?: number;
    currency?: string;
    targeting?: Prisma.InputJsonValue;
  }) {
    await this.requireBrand(input);
    const campaign = await this.db.marketingCampaign.findUnique({
      where: { id: input.marketingCampaignId },
    });
    if (!campaign) throw new Error("CAMPAIGN_NOT_FOUND");
    if (campaign.organizationId !== input.organizationId || campaign.brandId !== input.brandId) {
      throw new Error("TENANT_ANCESTRY_MISMATCH");
    }
    if (campaign.channelMode === "ORGANIC") throw new Error("PAID_CHANNEL_NOT_ALLOWED");
    if (input.creativePostId) {
      const post = await this.db.post.findUnique({ where: { id: input.creativePostId } });
      if (!post || post.organizationId !== input.organizationId || post.brandId !== input.brandId) {
        throw new Error("TENANT_ANCESTRY_MISMATCH");
      }
    }
    return this.db.metaAdsCampaign.create({
      data: {
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        brandId: input.brandId,
        marketingCampaignId: input.marketingCampaignId,
        creativePostId: input.creativePostId,
        name: input.name,
        objective: input.objective,
        budgetMinor: input.budgetMinor,
        currency: input.currency ?? "VND",
        targeting: input.targeting,
      },
    });
  }
  async transitionMetaAdsCampaign(id: string, next: MetaAdsState) {
    const current = await this.db.metaAdsCampaign.findUnique({ where: { id } });
    if (!current) throw new Error("META_ADS_CAMPAIGN_NOT_FOUND");
    assertMetaAdsTransition(current.state as MetaAdsState, next);
    return this.db.metaAdsCampaign.update({ where: { id }, data: { state: next } });
  }

  async recordMetaAdsMetrics(input: {
    metaAdsCampaignId: string;
    capturedAt: Date;
    spendMinor?: number;
    impressions?: number;
    reach?: number;
    clicks?: number;
    linkClicks?: number;
    conversions?: number;
    conversionValueMinor?: number;
    source?: string;
    evidence?: Prisma.InputJsonValue;
  }) {
    const campaign = await this.db.metaAdsCampaign.findUnique({
      where: { id: input.metaAdsCampaignId },
    });
    if (!campaign) throw new Error("META_ADS_CAMPAIGN_NOT_FOUND");
    return this.db.metaAdsMetricSnapshot.create({
      data: {
        organizationId: campaign.organizationId,
        brandId: campaign.brandId,
        metaAdsCampaignId: campaign.id,
        capturedAt: input.capturedAt,
        spendMinor: input.spendMinor,
        impressions: input.impressions,
        reach: input.reach,
        clicks: input.clicks,
        linkClicks: input.linkClicks,
        conversions: input.conversions,
        conversionValueMinor: input.conversionValueMinor,
        source: input.source ?? "MANUAL",
        evidence: input.evidence,
      },
    });
  }
  async getUnifiedPerformanceEvidence(
    organizationId: string,
    brandId: string,
  ): Promise<H1PerformanceEvidence[]> {
    const [organic, paid] = await Promise.all([
      this.db.metricSnapshot.findMany({
        where: { post: { organizationId, brandId } },
        include: { post: { select: { id: true, permalink: true } } },
      }),
      this.db.metaAdsMetricSnapshot.findMany({
        where: { organizationId, brandId },
      }),
    ]);

    const rows: H1PerformanceEvidence[] = organic.map((m) => ({
      channel: "ORGANIC",
      refId: m.postId,
      capturedAt: m.capturedAt,
      source: m.source,
      metrics: {
        reach: m.reach,
        engagement: m.engagement,
        comments: m.comments,
        shares: m.shares,
        saves: m.saves,
      },
      evidence: { postId: m.post.id, permalink: m.post.permalink },
    }));
    for (const m of paid) {
      rows.push({
        channel: "PAID",
        refId: m.metaAdsCampaignId,
        capturedAt: m.capturedAt,
        source: m.source,
        metrics: {
          spendMinor: m.spendMinor,
          impressions: m.impressions,
          reach: m.reach,
          clicks: m.clicks,
          linkClicks: m.linkClicks,
          conversions: m.conversions,
          conversionValueMinor: m.conversionValueMinor,
        },
        evidence: m.evidence,
      });
    }
    return rows.sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
  }
}
