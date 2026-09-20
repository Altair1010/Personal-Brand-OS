"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";
import { PrismaH1ProductSpine } from "@/lib/piltover/modules/marketing/infrastructure/prisma-h1-product-spine";

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
      include: { delivery: true },
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
      organicPosts: c.deliveries.map((d) => ({
        id: d.post.id,
        title: d.post.topic ?? "Bài đăng không tiêu đề",
        status: d.post.status,
        deliveryState: d.state,
        scheduledAt: d.scheduledAt?.toISOString() ?? null,
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
    })),
  };
}
const createCampaignSchema = z.object({
  name: z.string().trim().min(2),
  objective: z.string().trim().min(2),
  channelMode: z.enum(["ORGANIC", "PAID", "MIXED"]),
  strategyVersionId: z.string().min(1).optional(),
});

export async function createCampaign(
  input: z.input<typeof createCampaignSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createCampaignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Thông tin chiến dịch không hợp lệ." };
  try {
    const tenant = await resolveLocalTenant(db);
    const campaign = await spine.createCampaign({ ...tenant, ...parsed.data });
    revalidatePath("/campaigns");
    return { ok: true, data: { id: campaign.id } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Không thể tạo chiến dịch." };
  }
}
const scheduleSchema = z.object({
  campaignId: z.string().min(1),
  postId: z.string().min(1),
  scheduledAt: z.string().datetime(),
});

export async function scheduleOrganicPost(
  input: z.input<typeof scheduleSchema>,
): Promise<ActionResult> {
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Lịch đăng không hợp lệ." };
  try {
    const tenant = await resolveLocalTenant(db);
    await spine.scheduleOrganicPost({
      ...tenant,
      campaignId: parsed.data.campaignId,
      postId: parsed.data.postId,
      scheduledAt: new Date(parsed.data.scheduledAt),
    });
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
