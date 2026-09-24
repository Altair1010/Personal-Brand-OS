"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  aggregate,
  type PerfPost,
  type AggregateResult,
} from "@/lib/performance-engine/aggregate";
import { computeDaysSincePost } from "@/lib/performance-engine/computeDaysSincePost";
import { AgentExecutionGateway } from "@/lib/piltover/modules/agents/application/agent-execution-gateway";
import { PrismaJobQueue } from "@/lib/piltover/modules/agents/infrastructure/prisma-job-queue";
import { stableHash } from "@/lib/piltover/shared/contracts/stable-json";
import {
  MarketingIntelligenceEvidenceSchema,
  MarketingIntelligenceResultSchema,
  validateMarketingIntelligenceEvidenceRefs,
} from "@/lib/piltover/modules/marketing/domain/marketing-intelligence";
import { RunResultSchema } from "@/lib/piltover/shared/contracts/control-plane";
import {
  verifyPageToken,
  resolvePostId,
  fetchPostInsights,
  FacebookGraphError,
} from "@/lib/facebook/graph";
import { encryptString, decryptString } from "@/lib/ai/keystore";
import { METRIC_SOURCES } from "@/lib/constants";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";
import { resolveCanonicalAgentBinding } from "@/lib/piltover/vnext/canonical-agent-binding";
import { upsertManualMetaPageConnection } from "@/lib/piltover/providers/connection-service";

// Single-user local app: fixed ids match the seed (prisma/seed.ts).
const USER_ID = "local";

// MetricSnapshot.source — source of truth là lib/constants (không rải literal).
const [SOURCE_MANUAL, SOURCE_FACEBOOK] = METRIC_SOURCES;

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ============================================================
// DTOs (serializable — Date → ISO string)
// ============================================================

export type PostMetricsDTO = {
  reach: number | null;
  engagement: number | null;
  comments: number | null;
  saves: number | null;
  inboxNote: string | null;
  conversionNote: string | null;
};

export type PostRow = {
  postId: string;
  title: string;
  pillarName: string | null;
  hookStyle: string | null;
  ctaIntensity: string | null;
  format: string | null;
  publishedAt: string | null;
  daysSincePost: number;
  facebookAccountId: string | null;
  metrics: PostMetricsDTO | null;
};

export type InsightDTO = {
  id: string;
  scope: string;
  refId: string | null;
  period: string | null;
  finding: string;
  evidence: string | null;
  recommendation: string | null;
  confidence: string;
  createdAt: string;
};

export type PerformanceData = {
  rows: PostRow[];
  aggregates: AggregateResult;
  latestInsights: InsightDTO[];
};

// evidence được lưu dạng Json {text: string} — đọc an toàn về string.
function evidenceToText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "text" in v) {
    const t = (v as { text: unknown }).text;
    return typeof t === "string" ? t : null;
  }
  return null;
}

// ============================================================
// Read
// ============================================================

async function loadPerfPosts(): Promise<PerfPost[]> {
  const [posts, pillars] = await Promise.all([
    db.post.findMany({
      where: { userId: USER_ID },
      include: { metrics: true },
      orderBy: { createdAt: "desc" },
    }),
    db.contentPillar.findMany({
      where: { userId: USER_ID },
      select: { id: true, name: true },
    }),
  ]);

  const pillarName = new Map(pillars.map((p) => [p.id, p.name]));

  return posts.map((post): PerfPost => {
    const snap = post.metrics[0] ?? null;
    return {
      id: post.id,
      objectiveKey: post.objectiveKey,
      pillarId: post.pillarId,
      pillarName: post.pillarId
        ? pillarName.get(post.pillarId) ?? null
        : null,
      hookStyle: post.hookStyle,
      ctaIntensity: post.ctaIntensity,
      format: post.format,
      topic: post.topic,
      metrics: snap
        ? {
            reach: snap.reach,
            engagement: snap.engagement,
            comments: snap.comments,
            saves: snap.saves,
            daysSincePost: snap.daysSincePost,
          }
        : null,
    };
  });
}

export async function getPerformanceData(
  facebookAccountId?: string | null,
): Promise<PerformanceData> {
  const postWhere =
    facebookAccountId != null
      ? { userId: USER_ID, facebookAccountId }
      : { userId: USER_ID };

  const [posts, pillars, insights] = await Promise.all([
    db.post.findMany({
      where: postWhere,
      include: { metrics: true },
      orderBy: { createdAt: "desc" },
    }),
    db.contentPillar.findMany({
      where: { userId: USER_ID },
      select: { id: true, name: true },
    }),
    db.performanceInsight.findMany({
      where: { userId: USER_ID },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const pillarName = new Map(pillars.map((p) => [p.id, p.name]));

  const perfPosts: PerfPost[] = [];
  const rows: PostRow[] = [];

  for (const post of posts) {
    const snap = post.metrics[0] ?? null;
    const name = post.pillarId
      ? pillarName.get(post.pillarId) ?? null
      : null;

    perfPosts.push({
      id: post.id,
      objectiveKey: post.objectiveKey,
      pillarId: post.pillarId,
      pillarName: name,
      hookStyle: post.hookStyle,
      ctaIntensity: post.ctaIntensity,
      format: post.format,
      topic: post.topic,
      metrics: snap
        ? {
            reach: snap.reach,
            engagement: snap.engagement,
            comments: snap.comments,
            saves: snap.saves,
            daysSincePost: snap.daysSincePost,
          }
        : null,
    });

    rows.push({
      postId: post.id,
      title: post.topic ?? "Bài đăng không tiêu đề",
      pillarName: name,
      hookStyle: post.hookStyle,
      ctaIntensity: post.ctaIntensity,
      format: post.format,
      publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
      daysSincePost: computeDaysSincePost(post),
      facebookAccountId: post.facebookAccountId,
      metrics: snap
        ? {
            reach: snap.reach,
            engagement: snap.engagement,
            comments: snap.comments,
            saves: snap.saves,
            inboxNote: snap.inboxNote,
            conversionNote: snap.conversionNote,
          }
        : null,
    });
  }

  return {
    rows,
    aggregates: aggregate(perfPosts),
    latestInsights: insights.map((ins) => ({
      id: ins.id,
      scope: ins.scope,
      refId: ins.refId,
      period: ins.period,
      finding: ins.finding,
      evidence: evidenceToText(ins.evidence),
      recommendation: ins.recommendation,
      confidence: ins.confidence,
      createdAt: ins.createdAt.toISOString(),
    })),
  };
}

// ============================================================
// Mutations
// ============================================================

const saveMetricSchema = z.object({
  postId: z.string().min(1),
  reach: z.number().int().min(0),
  engagement: z.number().int().min(0),
  comments: z.number().int().min(0),
  saves: z.number().int().min(0),
  inboxNote: z.string().optional(),
  conversionNote: z.string().optional(),
});

export type SaveMetricInput = z.input<typeof saveMetricSchema>;

export async function saveMetric(
  input: SaveMetricInput,
): Promise<ActionResult<{ postId: string }>> {
  const parsed = saveMetricSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Số liệu không hợp lệ (phải là số nguyên ≥ 0)." };
  }
  const v = parsed.data;

  const post = await db.post.findUnique({
    where: { id: v.postId },
    select: { id: true, userId: true, publishedAt: true, createdAt: true },
  });
  if (!post || post.userId !== USER_ID) {
    return { ok: false, error: "Không tìm thấy bài đăng." };
  }

  const daysSincePost = computeDaysSincePost(post);

  const data = {
    reach: v.reach,
    engagement: v.engagement,
    comments: v.comments,
    saves: v.saves,
    inboxNote: v.inboxNote ?? null,
    conversionNote: v.conversionNote ?? null,
    daysSincePost,
  };

  await db.metricSnapshot.upsert({
    where: { postId: v.postId },
    create: { postId: v.postId, source: SOURCE_MANUAL, ...data },
    update: data,
  });

  revalidatePath("/performance");
  return { ok: true, data: { postId: v.postId } };
}

export async function runInsight(): Promise<
  ActionResult<{
    count: number;
    warnings: string[];
    topPosts: string[];
    weakPillars: string[];
    runId?: string;
    agentStatus?: string;
  }>
> {
  const tenant = await resolveLocalTenant(db);
  const [organicRows, paidRows, appState] = await Promise.all([
    db.post.findMany({
      where: {
        userId: USER_ID,
        organizationId: tenant.organizationId,
        brandId: tenant.brandId,
        metrics: { some: {} },
      },
      include: { metrics: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.metaAdsMetricSnapshot.findMany({
      where: {
        organizationId: tenant.organizationId,
        brandId: tenant.brandId,
      },
      orderBy: { capturedAt: "desc" },
      take: 20,
      include: {
        metaAdsCampaign: {
          select: {
            id: true,
            name: true,
            state: true,
            marketingCampaign: {
              select: {
                objective: true,
                strategyVersionId: true,
              },
            },
          },
        },
      },
    }),
    db.appState.findUnique({
      where: { id: "singleton" },
      select: { activeStrategyId: true },
    }),
  ]);

  if (organicRows.length < 1 && paidRows.length < 1) {
    return { ok: false, error: "Chưa có đủ Organic hoặc Paid evidence để giao cho agent." };
  }

  const latestStrategy = appState?.activeStrategyId
    ? await db.strategyVersion.findFirst({
        where: { strategyId: appState.activeStrategyId },
        orderBy: { version: "desc" },
        include: { strategy: { select: { name: true } } },
      })
    : null;

  const evidence = MarketingIntelligenceEvidenceSchema.parse({
    period: "30 ngày gần nhất",
    strategy: {
      versionId: latestStrategy?.id ?? null,
      name: latestStrategy?.strategy.name ?? null,
      objective: paidRows[0]?.metaAdsCampaign.marketingCampaign.objective ?? null,
    },
    organic: organicRows.map((post) => {
      const m = post.metrics[0] ?? null;
      return {
        refId: post.id,
        title: post.topic ?? "Untitled post",
        reach: m?.reach ?? null,
        engagement: m?.engagement ?? null,
        comments: m?.comments ?? null,
        saves: m?.saves ?? null,
        source: m?.source ?? "unknown",
      };
    }),
    paid: paidRows.map((row) => ({
      refId: row.metaAdsCampaignId,
      campaignName: row.metaAdsCampaign.name,
      state: row.metaAdsCampaign.state,
      spendMinor: row.spendMinor,
      impressions: row.impressions,
      reach: row.reach,
      clicks: row.clicks,
      linkClicks: row.linkClicks,
      conversions: row.conversions,
      conversionValueMinor: row.conversionValueMinor,
      source: row.source,
    })),
  });

  const workers = await db.worker.findMany({
    where: {
      status: "ACTIVE",
      lastSeenAt: { gt: new Date(Date.now() - 60_000) },
    },
    include: { capabilities: true },
    orderBy: { lastSeenAt: "desc" },
  });
  const openClawWorker = workers.find((worker) =>
    worker.capabilities.some(({ capability }) => capability === "agent.execute.openclaw"),
  );
  const oauthWorker = workers.find((worker) =>
    worker.capabilities.some(({ capability }) => capability === "agent.execute.oauth"),
  );

  const route = openClawWorker
    ? {
        kind: "OPENCLAW" as const,
        controller: "openclaw" as const,
        support: {
          termius: openClawWorker.capabilities.some(
            ({ capability }) => capability === "openclaw.support.termius",
          ),
          router9: openClawWorker.capabilities.some(
            ({ capability }) => capability === "openclaw.support.9router",
          ),
        },
      }
    : oauthWorker
      ? {
          kind: "OAUTH" as const,
          connector: oauthWorker.runtimeAdapter,
        }
      : {
          kind: "OPENCLAW" as const,
          controller: "openclaw" as const,
          support: { termius: false, router9: false },
        };

  const evidenceHash = stableHash(evidence);
  const agentBinding = await resolveCanonicalAgentBinding(db, "marketing-intelligence");
  const bindingHash = stableHash(agentBinding).slice(0, 12);
  const gateway = new AgentExecutionGateway(new PrismaJobQueue(db));
  const dispatched = await gateway.dispatch({
    organizationId: tenant.organizationId,
    workspaceId: tenant.workspaceId,
    brandId: tenant.brandId,
    ...agentBinding,
    repositoryAlias: "personal-brand-os",
    roleRef: "role:marketing-intelligence@h1",
    taskType: "MARKETING_INTELLIGENCE",
    instruction:
      "Analyze supplied Organic and Paid evidence. Return only evidence-backed findings, recommendations, confidence and exact evidence references. Do not claim Meta delivery when state is EXTERNAL_NOT_CONNECTED.",
    contextRef: {
      id: `marketing-intelligence:${tenant.brandId}:${evidenceHash}`,
      hash: evidenceHash,
    },
    permissionManifestRef: "permission:h1-marketing-intelligence",
    route,
    taskPayload: {
      evidence,
      resultContract: "MarketingIntelligenceResult/v1",
    },
    idempotencyKey: `h1-marketing-intelligence:${tenant.brandId}:${evidenceHash}:${bindingHash}`,
    requiredCapabilities: ["marketing.intelligence"],
    priority: 60,
    executionPolicy: { mode: "parallel", resourceKey: null },
  });

  revalidatePath("/performance");
  revalidatePath("/");

  return {
    ok: true,
    data: {
      count: 0,
      warnings: [
        dispatched.status === "QUEUED"
          ? "Marketing Intelligence đã được giao cho Agent Control Plane."
          : `Agent run status: ${dispatched.status}`,
      ],
      topPosts: [],
      weakPillars: [],
      runId: dispatched.runId,
      agentStatus: dispatched.status,
    },
  };
}

export async function syncLatestMarketingIntelligence(): Promise<
  ActionResult<{ count: number; runId: string }>
> {
  const tenant = await resolveLocalTenant(db);
  const completedRuns = await db.agentRun.findMany({
    where: {
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      brandId: tenant.brandId,
      status: "COMPLETED",
      roleRef: "role:marketing-intelligence@h1",
    },
    orderBy: { completedAt: "desc" },
    take: 20,
  });
  const run = completedRuns.find((candidate) => {
    if (!candidate.terminalResult || !candidate.task || typeof candidate.task !== "object" || Array.isArray(candidate.task)) {
      return false;
    }
    return MarketingIntelligenceEvidenceSchema.safeParse(
      (candidate.task as Record<string, unknown>).evidence,
    ).success;
  });
  if (!run?.terminalResult) {
    return {
      ok: false,
      error: "Chưa có Marketing Intelligence agent run hoàn tất với evidence hợp lệ.",
    };
  }

  const terminal = RunResultSchema.parse(run.terminalResult);
  const artifact = terminal.artifacts?.find(
    (item) => item.kind === "marketing-intelligence-result",
  );
  if (!artifact?.payload) {
    return {
      ok: false,
      error: "Agent run chưa trả artifact marketing-intelligence-result.",
    };
  }

  const task =
    run.task && typeof run.task === "object" && !Array.isArray(run.task)
      ? (run.task as Record<string, unknown>)
      : {};
  const evidence = MarketingIntelligenceEvidenceSchema.parse(task.evidence);
  const output = MarketingIntelligenceResultSchema.parse(artifact.payload);
  const refCheck = validateMarketingIntelligenceEvidenceRefs(evidence, output);
  if (!refCheck.ok) {
    return {
      ok: false,
      error: `Agent evidence refs không hợp lệ: ${refCheck.invalidRefs.join(", ")}`,
    };
  }

  await db.performanceInsight.deleteMany({
    where: {
      userId: USER_ID,
      organizationId: tenant.organizationId,
      brandId: tenant.brandId,
    },
  });
  for (const ins of output.insights) {
    await db.performanceInsight.create({
      data: {
        userId: USER_ID,
        organizationId: tenant.organizationId,
        brandId: tenant.brandId,
        scope: ins.scope,
        refId: ins.refId ?? null,
        period: evidence.period,
        finding: ins.finding,
        evidence: {
          text: ins.evidence,
          refs: ins.evidenceRefs,
          mode: "agent_control_plane",
          agentRunId: run.id,
          artifactRef: artifact.ref,
        },
        recommendation: ins.recommendation,
        confidence: ins.confidence,
      },
    });
  }

  revalidatePath("/performance");
  revalidatePath("/review");
  revalidatePath("/");
  return { ok: true, data: { count: output.insights.length, runId: run.id } };
}

// ============================================================
// Facebook (EM1c) — connect account, list, auto-fetch metric
// ============================================================

const connectFacebookAccountSchema = z.object({
  pageId: z.string().min(1),
  pageAccessToken: z.string().min(20),
});

export type ConnectFacebookAccountInput = z.input<
  typeof connectFacebookAccountSchema
>;

export async function connectFacebookAccount(
  input: ConnectFacebookAccountInput,
): Promise<ActionResult<{ pageId: string; pageName: string }>> {
  const parsed = connectFacebookAccountSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Thông tin không hợp lệ (pageId trống hoặc token quá ngắn).",
    };
  }
  const { pageId, pageAccessToken } = parsed.data;

  let pageName: string;
  try {
    ({ pageName } = await verifyPageToken(pageId, pageAccessToken));
  } catch (e) {
    if (e instanceof FacebookGraphError) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: "Không kết nối được trang Facebook." };
  }

  const accessToken = encryptString(pageAccessToken);
  const tenant = await resolveLocalTenant(db);

  await db.facebookAccount.upsert({
    where: { ownerRef_pageId: { ownerRef: USER_ID, pageId } },
    create: {
      ownerRef: USER_ID,
      organizationId: tenant.organizationId,
      brandId: tenant.brandId,
      pageId,
      pageName,
      accessToken,
    },
    update: {
      organizationId: tenant.organizationId,
      brandId: tenant.brandId,
      pageName,
      accessToken,
    },
  });
  await upsertManualMetaPageConnection(db, { pageId, pageName, pageAccessToken });

  revalidatePath("/performance");
  revalidatePath("/settings");
  return { ok: true, data: { pageId, pageName } };
}

export type FacebookAccountDTO = {
  id: string;
  pageId: string;
  pageName: string;
};

export async function listFacebookAccounts(): Promise<FacebookAccountDTO[]> {
  const tenant = await resolveLocalTenant(db);
  return db.facebookAccount.findMany({
    where: {
      ownerRef: USER_ID,
      organizationId: tenant.organizationId,
      brandId: tenant.brandId,
      status: "ACTIVE",
    },
    select: { id: true, pageId: true, pageName: true },
    orderBy: { linkedAt: "desc" },
  });
}

const fetchMetricFromUrlSchema = z.object({
  postId: z.string().min(1),
  postUrl: z.string().min(1),
});

export type FetchMetricFromUrlInput = z.input<typeof fetchMetricFromUrlSchema>;

export async function fetchMetricFromUrl(
  input: FetchMetricFromUrlInput,
): Promise<ActionResult<{ postId: string }>> {
  const parsed = fetchMetricFromUrlSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Thiếu link bài viết hoặc bài đăng." };
  }
  const { postId, postUrl } = parsed.data;

  const post = await db.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      userId: true,
      publishedAt: true,
      createdAt: true,
      facebookAccountId: true,
    },
  });
  if (!post || post.userId !== USER_ID) {
    return { ok: false, error: "Không tìm thấy bài đăng." };
  }
  if (!post.facebookAccountId) {
    return {
      ok: false,
      error:
        "Bài đăng chưa gắn trang Facebook — kết nối trang rồi thử lại, hoặc nhập tay.",
    };
  }

  const account = await db.facebookAccount.findUnique({
    where: { id: post.facebookAccountId },
    select: {
      accessToken: true,
      status: true,
      providerResource: {
        select: {
          status: true,
          connection: { select: { status: true, revokedAt: true } },
        },
      },
    },
  });
  if (!account) {
    return {
      ok: false,
      error: "Không tìm thấy trang Facebook đã gắn — kết nối lại rồi thử.",
    };
  }
  if (
    account.status === "REVOKED" ||
    account.providerResource?.status === "REVOKED" ||
    account.providerResource?.connection.revokedAt ||
    account.providerResource?.connection.status === "REVOKED"
  ) {
    return {
      ok: false,
      error: "Kết nối Facebook đã bị thu hồi — hãy reconnect trước khi gọi provider.",
    };
  }

  let insights;
  try {
    const token = decryptString(account.accessToken);
    const graphPostId = resolvePostId(postUrl);
    insights = await fetchPostInsights(token, graphPostId);
  } catch (e) {
    if (e instanceof FacebookGraphError) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: "Không lấy được số liệu từ Facebook." };
  }

  const daysSincePost = computeDaysSincePost(post);

  const data = {
    reach: insights.reach,
    engagement: insights.engagement,
    comments: insights.comments,
    saves: insights.saves,
    daysSincePost,
    source: SOURCE_FACEBOOK,
    postUrl,
    fbRawResponse: insights.raw as never,
    fetchedAt: new Date(),
  };

  await db.metricSnapshot.upsert({
    where: { postId },
    create: { postId, ...data },
    update: data,
  });

  revalidatePath("/performance");
  return { ok: true, data: { postId } };
}

export type PaidMetricDTO = {
  id: string;
  campaignName: string;
  state: string;
  capturedAt: string;
  spendMinor: number | null;
  impressions: number | null;
  reach: number | null;
  clicks: number | null;
  linkClicks: number | null;
  conversions: number | null;
  source: string;
};

export async function getPaidPerformanceData(): Promise<PaidMetricDTO[]> {
  let tenant;
  try {
    tenant = await resolveLocalTenant(db);
  } catch {
    return [];
  }
  const rows = await db.metaAdsMetricSnapshot.findMany({
    where: {
      organizationId: tenant.organizationId,
      brandId: tenant.brandId,
    },
    orderBy: { capturedAt: "desc" },
    take: 20,
    include: {
      metaAdsCampaign: { select: { name: true, state: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    campaignName: row.metaAdsCampaign.name,
    state: row.metaAdsCampaign.state,
    capturedAt: row.capturedAt.toISOString(),
    spendMinor: row.spendMinor,
    impressions: row.impressions,
    reach: row.reach,
    clicks: row.clicks,
    linkClicks: row.linkClicks,
    conversions: row.conversions,
    source: row.source,
  }));
}

export type AgentRuntimeStatus = {
  ready: boolean;
  route: "OPENCLAW" | "OAUTH" | null;
  controller: string | null;
  termius: boolean;
  router9: boolean;
  reason: string | null;
};

export async function getAgentRuntimeStatus(): Promise<AgentRuntimeStatus> {
  const freshAfter = new Date(Date.now() - 60_000);
  const workers = await db.worker.findMany({
    where: {
      status: "ACTIVE",
      lastSeenAt: { gt: freshAfter },
    },
    include: { capabilities: true },
    orderBy: { lastSeenAt: "desc" },
  });

  const openClaw = workers.find((worker) =>
    worker.capabilities.some(({ capability }) => capability === "agent.execute.openclaw"),
  );
  if (openClaw) {
    return {
      ready: true,
      route: "OPENCLAW",
      controller: "openclaw",
      termius: openClaw.capabilities.some(
        ({ capability }) => capability === "openclaw.support.termius",
      ),
      router9: openClaw.capabilities.some(
        ({ capability }) => capability === "openclaw.support.9router",
      ),
      reason: null,
    };
  }

  const oauth = workers.find((worker) =>
    worker.capabilities.some(({ capability }) => capability === "agent.execute.oauth"),
  );
  if (oauth) {
    return {
      ready: true,
      route: "OAUTH",
      controller: oauth.runtimeAdapter,
      termius: false,
      router9: false,
      reason: null,
    };
  }

  return {
    ready: false,
    route: null,
    controller: null,
    termius: false,
    router9: false,
    reason:
      "Chưa có Agent worker kết nối qua OpenClaw hoặc OAuth. Termius/9router chỉ là lớp hỗ trợ cho OpenClaw, không phải AI provider.",
  };
}
