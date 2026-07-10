// Aggregation thuần cho Performance tab. Không AI, không I/O DB.
// Nhận PerfPost[] đã load (Post mirror dims + MetricSnapshot 1-1).

export type PerfMetrics = {
  reach: number | null;
  engagement: number | null;
  comments: number | null;
  saves: number | null;
  daysSincePost: number | null;
};

export type PerfPost = {
  id: string;
  objectiveKey: string | null;
  pillarId: string | null;
  pillarName: string | null;
  hookStyle: string | null;
  ctaIntensity: string | null;
  format: string | null;
  topic: string | null;
  metrics: PerfMetrics | null; // null nếu Post chưa có snapshot
};

export type Group = {
  label: string;
  count: number;
  avgReach: number;
  avgEngagement: number;
};

export type AggregateResult = {
  byPillar: Group[];
  byHook: Group[];
  byCta: Group[];
  byFormat: Group[];
};

const UNKNOWN_PILLAR = "(không rõ)";

/**
 * Group posts theo 1 chiều. `dim` trả về key nhóm (null/"" → bỏ khỏi kết quả).
 * avg tính trên các post CÓ metrics; post metrics=null vẫn tính count nhưng
 * không vào mẫu số avg.
 */
function groupBy(
  posts: PerfPost[],
  dim: (p: PerfPost) => string | null,
): Group[] {
  const buckets = new Map<
    string,
    { count: number; reachSum: number; engSum: number; metricCount: number }
  >();

  for (const p of posts) {
    const key = dim(p);
    if (key === null || key === "") continue;

    let b = buckets.get(key);
    if (b === undefined) {
      b = { count: 0, reachSum: 0, engSum: 0, metricCount: 0 };
      buckets.set(key, b);
    }
    b.count += 1;
    if (p.metrics !== null) {
      b.reachSum += p.metrics.reach ?? 0;
      b.engSum += p.metrics.engagement ?? 0;
      b.metricCount += 1;
    }
  }

  const out: Group[] = [];
  for (const [label, b] of buckets) {
    const denom = b.metricCount > 0 ? b.metricCount : 1;
    out.push({
      label,
      count: b.count,
      avgReach: b.metricCount > 0 ? Math.round(b.reachSum / denom) : 0,
      avgEngagement: b.metricCount > 0 ? Math.round(b.engSum / denom) : 0,
    });
  }
  return out;
}

export function aggregate(posts: PerfPost[]): AggregateResult {
  return {
    byPillar: groupBy(posts, (p) => p.pillarName ?? UNKNOWN_PILLAR),
    byHook: groupBy(posts, (p) => p.hookStyle),
    byCta: groupBy(posts, (p) => p.ctaIntensity),
    byFormat: groupBy(posts, (p) => p.format),
  };
}

export type InsightPost = {
  id: string;
  objective: string;
  pillar: string;
  hookStyle: string;
  ctaIntensity: string;
  format: string;
  metrics: {
    reach: number;
    engagement: number;
    comments: number;
    saves: number;
    daysSincePost: number;
  };
};

export type InsightInput = {
  posts: InsightPost[];
  period: string;
};

/**
 * Map sang input cho module D.14 (AI insight). CHỈ gồm post CÓ metrics —
 * insight cần số thật. Field metrics null → 0.
 */
export function buildInsightInput(
  posts: PerfPost[],
  period: string,
): InsightInput {
  const withMetrics: InsightPost[] = [];
  for (const p of posts) {
    if (p.metrics === null) continue;
    const m = p.metrics;
    withMetrics.push({
      id: p.id,
      objective: p.objectiveKey ?? "",
      pillar: p.pillarName ?? "",
      hookStyle: p.hookStyle ?? "",
      ctaIntensity: p.ctaIntensity ?? "",
      format: p.format ?? "",
      metrics: {
        reach: m.reach ?? 0,
        engagement: m.engagement ?? 0,
        comments: m.comments ?? 0,
        saves: m.saves ?? 0,
        daysSincePost: m.daysSincePost ?? 0,
      },
    });
  }
  return { posts: withMetrics, period };
}
