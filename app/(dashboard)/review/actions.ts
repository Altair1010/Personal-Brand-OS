"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { type PerfPost } from "@/lib/performance-engine/aggregate";
import { revisionOutputSchema, type RevisionOutput } from "@/lib/prompts/revision";
import { ruleWarnings } from "@/lib/strategy-engine/ruleWarnings";
import { applyRevision } from "@/lib/strategy-engine/applyRevision";
import { normalizeRecordTo100 } from "@/lib/strategy-engine/normalizeRatio";
import { AgentExecutionGateway } from "@/lib/piltover/modules/agents/application/agent-execution-gateway";
import { PrismaJobQueue } from "@/lib/piltover/modules/agents/infrastructure/prisma-job-queue";
import { stableHash } from "@/lib/piltover/shared/contracts/stable-json";
import { RunResultSchema } from "@/lib/piltover/shared/contracts/control-plane";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";
import { resolveCanonicalAgentBinding } from "@/lib/piltover/vnext/canonical-agent-binding";

// Single-user local app: fixed ids match the seed (prisma/seed.ts).
const USER_ID = "local";
const APP_STATE_ID = "singleton";

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ============================================================
// DTOs (serializable — Date → ISO string)
// ============================================================

export type VersionRatioDTO = {
  version: number;
  contentRatio: Record<string, number>;
};

export type InsightDTO = {
  id: string;
  scope: string;
  finding: string;
  evidence: string | null;
  recommendation: string | null;
  confidence: string;
  createdAt: string;
};

export type VersionPerf = {
  version: number;
  postCount: number;
  avgReach: number;
  avgEngagement: number;
};

export type ReviewData = {
  hasStrategy: boolean;
  activeVersion: VersionRatioDTO | null;
  previousVersion: VersionRatioDTO | null;
  latestInsights: InsightDTO[];
  versionPerf: VersionPerf[];
  weekNumber: number;
};

// RevisionBundle = RevisionOutput + warnings đã gộp (rule + AI) + so sánh ratio.
export type RevisionBundle = RevisionOutput & {
  currentContentRatio: Record<string, number>;
  currentVersion: number;
};

// contentRatio lưu Json (Record<string, number>) — đọc an toàn.
function toRatio(v: unknown): Record<string, number> {
  if (v === null || typeof v !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "number") out[k] = val;
  }
  return out;
}

// evidence lưu Json {text: string} — đọc an toàn về string (mirror performance).
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
// Loaders (chung cho getReviewData + generateRevision)
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
      pillarName: post.pillarId ? pillarName.get(post.pillarId) ?? null : null,
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

// Attribution compare: group Post theo strategyVersionId (chỉ version của active
// strategy), avgReach/avgEngagement trung bình trên Post CÓ metric.
async function loadVersionPerf(
  activeStrategyId: string | null,
): Promise<VersionPerf[]> {
  if (!activeStrategyId) return [];

  const versions = await db.strategyVersion.findMany({
    where: { strategyId: activeStrategyId },
    select: { id: true, version: true },
  });
  if (versions.length === 0) return [];

  const versionNum = new Map(versions.map((v) => [v.id, v.version]));

  const posts = await db.post.findMany({
    where: {
      userId: USER_ID,
      strategyVersionId: { in: versions.map((v) => v.id) },
    },
    select: { strategyVersionId: true, metrics: true },
  });

  const buckets = new Map<
    number,
    { postCount: number; reachSum: number; engSum: number; metricCount: number }
  >();
  for (const v of versions) buckets.set(v.version, {
    postCount: 0,
    reachSum: 0,
    engSum: 0,
    metricCount: 0,
  });

  for (const post of posts) {
    if (!post.strategyVersionId) continue;
    const num = versionNum.get(post.strategyVersionId);
    if (num === undefined) continue;
    const b = buckets.get(num)!;
    b.postCount += 1;
    const snap = post.metrics[0] ?? null;
    if (snap) {
      b.reachSum += snap.reach ?? 0;
      b.engSum += snap.engagement ?? 0;
      b.metricCount += 1;
    }
  }

  return [...buckets.entries()]
    .filter(([, b]) => b.postCount > 0)
    .map(([version, b]) => ({
      version,
      postCount: b.postCount,
      avgReach: b.metricCount > 0 ? Math.round(b.reachSum / b.metricCount) : 0,
      avgEngagement:
        b.metricCount > 0 ? Math.round(b.engSum / b.metricCount) : 0,
    }))
    .sort((a, b) => a.version - b.version);
}

// ============================================================
// Read
// ============================================================

export async function getReviewData(): Promise<ReviewData> {
  const appState = await db.appState.findUnique({
    where: { id: APP_STATE_ID },
    select: { activeStrategyId: true },
  });
  const activeStrategyId = appState?.activeStrategyId ?? null;

  const [versions, insights, versionPerf] = await Promise.all([
    activeStrategyId
      ? db.strategyVersion.findMany({
          where: { strategyId: activeStrategyId },
          orderBy: { version: "desc" },
          take: 2,
          select: { version: true, contentRatio: true },
        })
      : Promise.resolve([]),
    db.performanceInsight.findMany({
      where: { userId: USER_ID },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    loadVersionPerf(activeStrategyId),
  ]);

  const activeVersion: VersionRatioDTO | null = versions[0]
    ? { version: versions[0].version, contentRatio: toRatio(versions[0].contentRatio) }
    : null;
  const previousVersion: VersionRatioDTO | null = versions[1]
    ? { version: versions[1].version, contentRatio: toRatio(versions[1].contentRatio) }
    : null;

  // weekNumber suy đơn giản = số StrategyVersion hiện có (mỗi tuần chốt 1 version),
  // tối thiểu 1. Không cầu kỳ theo yêu cầu brief.
  const totalVersions = activeStrategyId
    ? await db.strategyVersion.count({ where: { strategyId: activeStrategyId } })
    : 0;
  const weekNumber = Math.max(totalVersions, 1);

  return {
    hasStrategy: activeVersion !== null,
    activeVersion,
    previousVersion,
    latestInsights: insights.map((ins) => ({
      id: ins.id,
      scope: ins.scope,
      finding: ins.finding,
      evidence: evidenceToText(ins.evidence),
      recommendation: ins.recommendation,
      confidence: ins.confidence,
      createdAt: ins.createdAt.toISOString(),
    })),
    versionPerf,
    weekNumber,
  };
}

// ============================================================
// AI: generate revision (KHÔNG ghi DB)
// ============================================================

export async function generateRevision(): Promise<
  ActionResult<{ runId: string; status: string }>
> {
  const tenant = await resolveLocalTenant(db);
  const appState = await db.appState.findUnique({
    where: { id: APP_STATE_ID },
    select: { activeStrategyId: true, activeGoalId: true },
  });
  const activeStrategyId = appState?.activeStrategyId ?? null;

  const version = activeStrategyId
    ? await db.strategyVersion.findFirst({
        where: { strategyId: activeStrategyId },
        orderBy: { version: "desc" },
        select: { version: true, contentRatio: true, weeklyThemes: true },
      })
    : null;
  if (!version) {
    return {
      ok: false,
      error: "Chưa có chiến lược để đánh giá. Hãy tạo chiến lược trước.",
    };
  }

  const currentContentRatio = toRatio(version.contentRatio);
  const weeklyThemes = Array.isArray(version.weeklyThemes) ? version.weeklyThemes : [];
  const posts = await loadPerfPosts();
  const ruleW = ruleWarnings(posts);
  const [insights, versionPerf, goal, totalVersions] = await Promise.all([
    db.performanceInsight.findMany({
      where: {
        userId: USER_ID,
        organizationId: tenant.organizationId,
        brandId: tenant.brandId,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    loadVersionPerf(activeStrategyId),
    appState?.activeGoalId
      ? db.goal.findUnique({
          where: { id: appState.activeGoalId },
          select: { name: true, mainMessage: true },
        })
      : Promise.resolve(null),
    db.strategyVersion.count({ where: { strategyId: activeStrategyId! } }),
  ]);

  const input = {
    currentStrategyVersion: {
      version: version.version,
      contentRatio: currentContentRatio,
      weeklyThemes,
    },
    insights: insights.map((ins) => ({
      refId: ins.id,
      scope: ins.scope,
      finding: ins.finding,
      evidence: evidenceToText(ins.evidence) ?? "",
      recommendation: ins.recommendation ?? "",
      confidence: ins.confidence,
    })),
    versionPerf,
    goal: {
      name: goal?.name ?? "Mục tiêu thương hiệu",
      description: goal?.mainMessage ?? undefined,
    },
    weekNumber: Math.max(totalVersions, 1),
    deterministicRuleWarnings: ruleW,
  };

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
          termius: openClawWorker.capabilities.some(({ capability }) => capability === "openclaw.support.termius"),
          router9: openClawWorker.capabilities.some(({ capability }) => capability === "openclaw.support.9router"),
        },
      }
    : oauthWorker
      ? { kind: "OAUTH" as const, connector: oauthWorker.runtimeAdapter }
      : {
          kind: "OPENCLAW" as const,
          controller: "openclaw" as const,
          support: { termius: false, router9: false },
        };

  const contextHash = stableHash(input);
  const agentBinding = await resolveCanonicalAgentBinding(db, "strategy-revision");
  const bindingHash = stableHash(agentBinding).slice(0, 12);
  const dispatched = await new AgentExecutionGateway(new PrismaJobQueue(db)).dispatch({
    organizationId: tenant.organizationId,
    workspaceId: tenant.workspaceId,
    brandId: tenant.brandId,
    ...agentBinding,
    repositoryAlias: "personal-brand-os",
    roleRef: "role:strategy-revision@h1",
    taskType: "STRATEGY_REVISION",
    instruction:
      "Review the supplied evidence-backed insights and attribution. Return a strategy-revision-result artifact. Do not mutate strategy state; Piltover will validate and require human apply.",
    contextRef: { id: `strategy-revision:${tenant.brandId}:${contextHash}`, hash: contextHash },
    permissionManifestRef: "permission:h1-strategy-revision",
    route,
    taskPayload: {
      context: input,
      resultContract: "StrategyRevisionResult/v1",
    },
    idempotencyKey: `h1-strategy-revision:${tenant.brandId}:${contextHash}:${bindingHash}`,
    requiredCapabilities: ["strategy.revise"],
    priority: 55,
    executionPolicy: { mode: "sequential", resourceKey: `strategy:${tenant.brandId}` },
  });

  return { ok: true, data: { runId: dispatched.runId, status: dispatched.status } };
}

export async function syncRevisionAgentResult(): Promise<ActionResult<RevisionBundle>> {
  const tenant = await resolveLocalTenant(db);
  const run = await db.agentRun.findFirst({
    where: {
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      brandId: tenant.brandId,
      roleRef: "role:strategy-revision@h1",
      status: "COMPLETED",
    },
    orderBy: { completedAt: "desc" },
  });
  if (!run?.terminalResult) {
    return { ok: false, error: "Chưa có Strategy Revision Agent run hoàn tất." };
  }

  const terminal = RunResultSchema.parse(run.terminalResult);
  const artifact = terminal.artifacts?.find((item) => item.kind === "strategy-revision-result");
  if (!artifact?.payload) {
    return { ok: false, error: "Revision Agent chưa trả artifact strategy-revision-result." };
  }

  const parsed = revisionOutputSchema.parse(artifact.payload);
  const out: RevisionOutput = {
    ...parsed,
    revisedContentRatio: normalizeRecordTo100(parsed.revisedContentRatio),
  };

  const task =
    run.task && typeof run.task === "object" && !Array.isArray(run.task)
      ? (run.task as Record<string, unknown>)
      : {};
  const context =
    task.context && typeof task.context === "object" && !Array.isArray(task.context)
      ? (task.context as Record<string, unknown>)
      : {};
  const currentStrategyVersion =
    context.currentStrategyVersion &&
    typeof context.currentStrategyVersion === "object" &&
    !Array.isArray(context.currentStrategyVersion)
      ? (context.currentStrategyVersion as Record<string, unknown>)
      : {};
  const currentContentRatio = toRatio(currentStrategyVersion.contentRatio);
  const currentVersion =
    typeof currentStrategyVersion.version === "number"
      ? currentStrategyVersion.version
      : 0;
  const deterministicWarnings = Array.isArray(context.deterministicRuleWarnings)
    ? context.deterministicRuleWarnings.filter((x): x is string => typeof x === "string")
    : [];

  return {
    ok: true,
    data: {
      ...out,
      warnings: [...deterministicWarnings, ...out.warnings],
      currentContentRatio,
      currentVersion,
    },
  };
}

// ============================================================
// Apply revision → tạo StrategyVersion mới
// ============================================================

export async function applyRevisionAction(input: {
  revisedContentRatio: Record<string, number>;
  reasonForNewVersion: string;
}): Promise<ActionResult<{ version: number; fromVersion: number }>> {
  try {
    const result = await applyRevision(input);
    revalidatePath("/review");
    revalidatePath("/");
    return {
      ok: true,
      data: { version: result.version, fromVersion: result.fromVersion },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ============================================================
// Dashboard helper — điều chỉnh gần nhất (nếu có ≥2 version)
// ============================================================

export type LatestAdjustment = {
  version: number;
  fromVersion: number;
  reason: string;
  currentRatio: Record<string, number>;
  revisedRatio: Record<string, number>;
};

export async function getLatestAdjustment(): Promise<LatestAdjustment | null> {
  const appState = await db.appState.findUnique({
    where: { id: APP_STATE_ID },
    select: { activeStrategyId: true },
  });
  if (!appState?.activeStrategyId) return null;

  const versions = await db.strategyVersion.findMany({
    where: { strategyId: appState.activeStrategyId },
    orderBy: { version: "desc" },
    take: 2,
    select: { version: true, contentRatio: true, reason: true },
  });
  if (versions.length < 2) return null;

  const [current, previous] = versions;
  return {
    version: current.version,
    fromVersion: previous.version,
    reason: current.reason,
    currentRatio: toRatio(previous.contentRatio),
    revisedRatio: toRatio(current.contentRatio),
  };
}
