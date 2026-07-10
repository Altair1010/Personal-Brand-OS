"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  aggregate,
  buildInsightInput,
  type PerfPost,
  type AggregateResult,
} from "@/lib/performance-engine/aggregate";
import { computeDaysSincePost } from "@/lib/performance-engine/computeDaysSincePost";
import { runModule } from "@/lib/ai/run";
import {
  performanceModule,
  enforceLowConfidence,
} from "@/lib/prompts/performance";

// Single-user local app: fixed ids match the seed (prisma/seed.ts).
const USER_ID = "local";

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

export async function getPerformanceData(): Promise<PerformanceData> {
  const [posts, pillars, insights] = await Promise.all([
    db.post.findMany({
      where: { userId: USER_ID },
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
    create: { postId: v.postId, source: "manual", ...data },
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
  }>
> {
  const perfPosts = await loadPerfPosts();
  const withMetrics = perfPosts.filter((p) => p.metrics !== null);
  if (withMetrics.length < 1) {
    return { ok: false, error: "Chưa có đủ số liệu để phân tích" };
  }

  const period = "30 ngày gần nhất";
  const inputData = buildInsightInput(withMetrics, period);

  const result = await runModule(performanceModule, inputData);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const out = enforceLowConfidence(result.data, withMetrics.length);

  // Reset insights của user rồi tạo batch mới từ out.insights.
  await db.performanceInsight.deleteMany({ where: { userId: USER_ID } });
  for (const ins of out.insights) {
    await db.performanceInsight.create({
      data: {
        userId: USER_ID,
        scope: ins.scope,
        refId: ins.refId ?? null,
        period,
        finding: ins.finding,
        evidence: { text: ins.evidence },
        recommendation: ins.recommendation,
        confidence: ins.confidence,
      },
    });
  }

  revalidatePath("/performance");
  return {
    ok: true,
    data: {
      count: out.insights.length,
      warnings: out.warnings,
      topPosts: out.topPosts,
      weakPillars: out.weakPillars,
    },
  };
}
