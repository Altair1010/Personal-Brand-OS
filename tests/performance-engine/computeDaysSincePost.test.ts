import { describe, it, expect } from "vitest";
import { computeDaysSincePost } from "@/lib/performance-engine/computeDaysSincePost";

const NOW = new Date("2026-01-20T00:00:00.000Z");

describe("computeDaysSincePost", () => {
  it("dùng publishedAt khi có", () => {
    const post = {
      publishedAt: new Date("2026-01-10T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    expect(computeDaysSincePost(post, NOW)).toBe(10);
  });

  it("publishedAt null → fallback createdAt", () => {
    const post = {
      publishedAt: null,
      createdAt: new Date("2026-01-15T00:00:00.000Z"),
    };
    expect(computeDaysSincePost(post, NOW)).toBe(5);
  });

  it("clamp ≥0 khi ref ở tương lai", () => {
    const post = {
      publishedAt: new Date("2026-02-01T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    expect(computeDaysSincePost(post, NOW)).toBe(0);
  });

  it("floor số ngày lẻ giờ", () => {
    const post = {
      publishedAt: new Date("2026-01-17T18:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    // 2 ngày 6 giờ → floor = 2
    expect(computeDaysSincePost(post, NOW)).toBe(2);
  });
});
