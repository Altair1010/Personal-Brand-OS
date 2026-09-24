"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";
import { PrismaH1ProductSpine } from "@/lib/piltover/modules/marketing/infrastructure/prisma-h1-product-spine";
import { CAMPAIGN_STATES, transitionExecutionCampaign } from "@/lib/piltover/vnext/campaign-service";
import { ensurePublishingJob } from "@/lib/piltover/vnext/publishing-engine";
import { stableHash } from "@/lib/piltover/shared/contracts/stable-json";

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const spine = new PrismaH1ProductSpine(db);

export type CampaignPostDTO = {
  id: string;
  title: string;
  status: string;
  deliveryState: string | null;
  scheduledAt: string | null;
  plannedDate: string | null;
};

export type MetaAdsDTO = {
  id: string;
  name: string;
  objective: string;
  state: string;
  budgetMinor: number | null;
  currency: string;
  creativePostId: string | null;
};
export type CampaignDTO = {
  id: string;
  name: string;
  objective: string;
  channelMode: string;
  status: string;
  strategyVersionId: string | null;
  imcPlanId: string | null;
  organicPosts: CampaignPostDTO[];
  metaAds: MetaAdsDTO[];
};

export type CampaignWorkspaceData = {
  strategyVersionId: string | null;
  campaigns: CampaignDTO[];
  approvedPosts: CampaignPostDTO[];
};

export async function getCampaignWorkspaceData(): Promise<CampaignWorkspaceData> {
  let tenant;
  try {
    tenant = await resolveLocalTenant(db);
  } catch {
    return { strategyVersionId: null, campaigns: [], approvedPosts: [] };
  }
  const appState = await db.appState.findUnique({ where: { id: "singleton" } });
  const version = appState?.activeStrategyId
    ? await db.strategyVersion.findFirst({
        where: { strategyId: appState.activeStrategyId },
        orderBy: { version: "desc" },
        select: { id: true },
      })
    : null;
  const [campaigns, posts] = await Promise.all([
    db.marketingCampaign.findMany({
      where: {
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        brandId: tenant.brandId,
      },
      orderBy: { createdAt: "desc" },
      include: {
        deliveries: {
          include: { post: { select: { id: true, topic: true, status: true } } },
        },
        metaAdsCampaigns: { orderBy: { createdAt: "desc" } },
      },
    }),
    db.post.findMany({
      where: {
        organizationId: tenant.organizationId,
        brandId: tenant.brandId,
        status: { in: ["approved", "posted"] },
      },
      orderBy: { createdAt: "desc" },
      include: {
        delivery: true,
        dailyPlan: { select: { date: true, dayIndex: true } },
      },
    }),
  ]);

  return {
    strategyVersionId: version?.id ?? null,
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      objective: c.objective,
      channelMode: c.channelMode,
      status: c.status,
      strategyVersionId: c.strategyVersionId,
      imcPlanId: c.imcPlanId,
      organicPosts: c.deliveries.map((d) => ({
        id: d.post.id,
        title: d.post.topic ?? "Bài đăng không tiêu đề",
        status: d.post.status,
        deliveryState: d.state,
        scheduledAt: d.scheduledAt?.toISOString() ?? null,
        plannedDate: null,
      })),
      metaAds: c.metaAdsCampaigns.map((a) => ({
        id: a.id,
        name: a.name,
        objective: a.objective,
        state: a.state,
        budgetMinor: a.budgetMinor,
        currency: a.currency,
        creativePostId: a.creativePostId,
      })),
    })),
    approvedPosts: posts.map((post) => ({
      id: post.id,
      title: post.topic ?? "Bài đăng không tiêu đề",
      status: post.status,
      deliveryState: post.delivery?.state ?? null,
      scheduledAt: post.delivery?.scheduledAt?.toISOString() ?? null,
      plannedDate: post.dailyPlan?.date?.toISOString() ?? null,
    })),
  };
}
const createCampaignSchema = z.object({
  name: z.string().trim().min(2),
  objective: z.string().trim().min(2),
  channelMode: z.enum(["ORGANIC", "PAID", "MIXED"]),
  strategyVersionId: z.string().min(1).optional(),
  imcPlanId: z.string().min(1).optional(),
  audienceIds: z.array(z.string()).optional(),
  channelIds: z.array(z.string()).optional(),
  budget: z.unknown().optional(),
  kpis: z.array(z.unknown()).optional(),
  creativePlatform: z.unknown().optional(),
  contentPlan: z.unknown().optional(),
  experimentIds: z.array(z.string()).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});

export async function createCampaign(
  input: z.input<typeof createCampaignSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createCampaignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Thông tin chiến dịch không hợp lệ." };
  try {
    const tenant = await resolveLocalTenant(db);
    const campaign = await spine.createCampaign({
      ...tenant,
      ...parsed.data,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : undefined,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : undefined,
    });
    revalidatePath("/campaigns");
    return { ok: true, data: { id: campaign.id } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Không thể tạo chiến dịch." };
  }
}
const transitionCampaignSchema = z.object({
  campaignId: z.string().min(1),
  status: z.enum(CAMPAIGN_STATES),
});

export async function transitionCampaign(
  input: z.input<typeof transitionCampaignSchema>,
): Promise<ActionResult<{ status: string }>> {
  const parsed = transitionCampaignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Trạng thái chiến dịch không hợp lệ." };
  try {
    const tenant = await resolveLocalTenant(db);
    const campaign = await db.marketingCampaign.findUnique({ where: { id: parsed.data.campaignId } });
    if (!campaign || campaign.organizationId !== tenant.organizationId || campaign.brandId !== tenant.brandId) {
      return { ok: false, error: "Không tìm thấy chiến dịch trong workspace hiện tại." };
    }
    const updated = await transitionExecutionCampaign(db, campaign.id, parsed.data.status);
    revalidatePath("/campaigns");
    return { ok: true, data: { status: updated.status } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Không thể đổi trạng thái chiến dịch." };
  }
}

const scheduleSchema = z.object({
  campaignId: z.string().min(1),
  postId: z.string().min(1),
  scheduledAt: z.string().datetime(),
  facebookAccountId: z.string().min(1).optional(),
});

export async function scheduleOrganicPost(
  input: z.input<typeof scheduleSchema>,
): Promise<ActionResult> {
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Lịch đăng không hợp lệ." };
  try {
    const tenant = await resolveLocalTenant(db);
    const scheduledAt = new Date(parsed.data.scheduledAt);
    await spine.scheduleOrganicPost({
      ...tenant,
      campaignId: parsed.data.campaignId,
      postId: parsed.data.postId,
      scheduledAt,
    });

    const post = await db.post.findUnique({
      where: { id: parsed.data.postId },
      include: {
        contentDraft: {
          include: { assets: { orderBy: { sortOrder: "asc" } } },
        },
      },
    });
    if (!post) return { ok: false, error: "Không tìm thấy Post." };

    const account = parsed.data.facebookAccountId
      ? await db.facebookAccount.findFirst({
          where: {
            id: parsed.data.facebookAccountId,
            brandId: tenant.brandId,
            status: { not: "REVOKED" },
          },
        })
      : await db.facebookAccount.findFirst({
          where: { brandId: tenant.brandId, status: { not: "REVOKED" } },
          orderBy: { linkedAt: "desc" },
        });

    if (account) {
      const assets = post.contentDraft.assets.map((asset) => ({
        assetId: asset.id,
        sourceType: asset.sourceType,
        mediaType: asset.mediaType,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        localPath: asset.localPath,
        sourceUrl: asset.sourceUrl,
        sortOrder: asset.sortOrder,
      }));
      await db.post.update({
        where: { id: post.id },
        data: { facebookAccountId: account.id },
      });
      const integrationId = `facebook:${account.id}`;
      const providerPayload = {
        text: post.finalText ?? "",
        format:
          assets.length === 0
            ? "text"
            : assets.length > 1
              ? "carousel"
              : assets[0]?.mediaType === "VIDEO"
                ? "video"
                : "image",
        media: assets,
      };
      const existingJob = await db.publishingJob.findFirst({
        where: {
          contentVariantId: post.id,
          providerPostId: null,
          status: { in: ["QUEUED", "RETRY_PENDING", "WAITING_APPROVAL", "BLOCKED"] },
        },
        orderBy: { createdAt: "desc" },
      });
      if (existingJob) {
        await db.publishingJob.update({
          where: { id: existingJob.id },
          data: {
            integrationId,
            scheduledAt,
            providerPayload,
            payloadFingerprint: stableHash(providerPayload),
            status: "QUEUED",
            nextAttemptAt: scheduledAt,
            blockedReason: null,
            error: null,
            errorCategory: null,
            leaseOwner: null,
            leaseExpiresAt: null,
          },
        });
      } else {
        await ensurePublishingJob(db, {
          organizationId: tenant.organizationId,
          brandId: tenant.brandId,
          contentVariantId: post.id,
          integrationId,
          scheduledAt,
          providerPayload,
          idempotencyMaterial: {
            postId: post.id,
            integrationId,
          },
        });
      }
    }

    revalidatePath("/campaigns");
    revalidatePath("/calendar");
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Không thể lên lịch." };
  }
}
const createMetaSchema = z.object({
  marketingCampaignId: z.string().min(1),
  creativePostId: z.string().min(1).optional(),
  name: z.string().trim().min(2),
  objective: z.string().trim().min(2),
  budgetMinor: z.number().int().min(0).optional(),
  currency: z.string().trim().min(3).max(3).default("VND"),
  audience: z.string().trim().optional(),
});

export async function createMetaAdsCampaign(
  input: z.input<typeof createMetaSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createMetaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Thiết lập Meta Ads không hợp lệ." };
  try {
    const tenant = await resolveLocalTenant(db);
    const ads = await spine.createMetaAdsCampaign({
      ...tenant,
      marketingCampaignId: parsed.data.marketingCampaignId,
      creativePostId: parsed.data.creativePostId,
      name: parsed.data.name,
      objective: parsed.data.objective,
      budgetMinor: parsed.data.budgetMinor,
      currency: parsed.data.currency.toUpperCase(),
      targeting: parsed.data.audience ? { audienceNote: parsed.data.audience } : undefined,
    });
    await spine.transitionMetaAdsCampaign(ads.id, "EXTERNAL_NOT_CONNECTED");
    revalidatePath("/campaigns");
    revalidatePath("/performance");
    return { ok: true, data: { id: ads.id } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Không thể tạo Meta Ads seam." };
  }
}

const metricSchema = z.object({
  metaAdsCampaignId: z.string().min(1),
  spendMinor: z.number().int().min(0),
  impressions: z.number().int().min(0),
  reach: z.number().int().min(0),
  clicks: z.number().int().min(0),
  linkClicks: z.number().int().min(0),
  conversions: z.number().min(0),
});

export async function saveMetaAdsMetrics(
  input: z.input<typeof metricSchema>,
): Promise<ActionResult> {
  const parsed = metricSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Số liệu Meta Ads không hợp lệ." };
  try {
    await spine.recordMetaAdsMetrics({
      ...parsed.data,
      capturedAt: new Date(),
      source: "MANUAL",
      evidence: {
        source: "manual-ui",
        note: "H1 demonstrable input; no live Meta API claim",
      },
    });
    revalidatePath("/campaigns");
    revalidatePath("/performance");
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Không thể lưu số liệu Meta Ads." };
  }
}
