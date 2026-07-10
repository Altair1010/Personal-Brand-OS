"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { type PerfPost } from "@/lib/performance-engine/aggregate";
import { runModule } from "@/lib/ai/run";
import { revisionModule, type RevisionOutput } from "@/lib/prompts/revision";
import { ruleWarnings } from "@/lib/strategy-engine/ruleWarnings";
import { applyRevision } from "@/lib/strategy-engine/applyRevision";

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

export async function generateRevision(): Promise<ActionResult<RevisionBundle>> {
  const appState = await db.appState.findUnique({
    where: { id: APP_STATE_ID },
    select: { activeStrategyId: true, activeGoalId: true },
  });
  const activeStrategyId = appState?.activeStrategyId ?? null;

  // 1. Active version (version + contentRatio + weeklyThemes).
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
      error:
        "Chưa có chiến lược để đánh giá. Hãy tạo chiến lược ở tab Chiến lược trước.",
    };
  }

  const currentContentRatio = toRatio(version.contentRatio);
  const weeklyThemes = Array.isArray(version.weeklyThemes)
    ? version.weeklyThemes
    : [];

  // 2. posts + rule warnings.
  const posts = await loadPerfPosts();
  const ruleW = ruleWarnings(posts);

  // 3. insights + versionPerf + goal + weekNumber.
  const [insights, versionPerf, goal, totalVersions] = await Promise.all([
    db.performanceInsight.findMany({
      where: { userId: USER_ID },
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
  };

  // 4. runModule (server-side, không HTTP).
  const result = await runModule(revisionModule, input);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const out = result.data;

  // 5. Bundle — gộp rule warnings + AI warnings, kèm ratio hiện tại để so diff.
  return {
    ok: true,
    data: {
      ...out,
      warnings: [...ruleW, ...out.warnings],
      currentContentRatio,
      currentVersion: version.version,
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
