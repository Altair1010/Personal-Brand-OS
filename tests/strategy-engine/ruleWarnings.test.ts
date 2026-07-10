import { describe, it, expect } from "vitest";
import { ruleWarnings } from "@/lib/strategy-engine/ruleWarnings";
import type { PerfPost } from "@/lib/performance-engine/aggregate";

function post(
  overrides: Partial<PerfPost> & { engagement?: number | null },
): PerfPost {
  const { engagement, ...rest } = overrides;
  const hasMetric = engagement !== undefined;
  return {
    id: Math.random().toString(36).slice(2),
    objectiveKey: "educate",
    pillarId: "p1",
    pillarName: "Giáo dục",
    hookStyle: null,
    ctaIntensity: null,
    format: null,
    topic: null,
    metrics: hasMetric
      ? {
          reach: 100,
          engagement: engagement ?? 0,
          comments: 0,
          saves: 0,
          daysSincePost: 1,
        }
      : null,
    ...rest,
  };
}

describe("ruleWarnings", () => {
  it("posts rỗng → []", () => {
    expect(ruleWarnings([])).toEqual([]);
  });

  it("conversion ≥ 40% → có cảnh báo bán hàng", () => {
    const posts = [
      post({ objectiveKey: "conversion" }),
      post({ objectiveKey: "conversion" }),
      post({ objectiveKey: "educate" }),
      post({ objectiveKey: "educate" }),
    ];
    const w = ruleWarnings(posts);
    expect(w.some((x) => x.includes("bài bán hàng (conversion)"))).toBe(true);
  });

  it("pillar yếu → có cảnh báo pillar", () => {
    // Pillar A engagement cao, pillar B rất thấp (< nửa trung vị).
    const posts = [
      post({ pillarName: "Bằng chứng", engagement: 100 }),
      post({ pillarName: "Bằng chứng", engagement: 100 }),
      post({ pillarName: "Giáo dục", engagement: 100 }),
      post({ pillarName: "Tin tức", engagement: 5 }),
    ];
    const w = ruleWarnings(posts);
    expect(w.some((x) => x.includes('Pillar "Tin tức" đang yếu'))).toBe(true);
  });

  it("case bình thường không cảnh báo", () => {
    const posts = [
      post({ pillarName: "A", objectiveKey: "educate", engagement: 100 }),
      post({ pillarName: "B", objectiveKey: "trust", engagement: 90 }),
      post({ pillarName: "C", objectiveKey: "story", engagement: 110 }),
    ];
    expect(ruleWarnings(posts)).toEqual([]);
  });
});
