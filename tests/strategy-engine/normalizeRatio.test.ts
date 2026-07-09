import { describe, it, expect } from "vitest";
import {
  normalizeWeightsTo100,
  normalizeRatioTo100,
  normalizeRecordTo100,
} from "@/lib/strategy-engine/normalizeRatio";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("normalizeWeightsTo100", () => {
  it("equal weights [33,33,33] → sum 100", () => {
    const out = normalizeWeightsTo100([33, 33, 33]);
    expect(sum(out)).toBe(100);
  });

  it("arbitrary weights [10,20,25] → scaled, sum 100", () => {
    const out = normalizeWeightsTo100([10, 20, 25]);
    expect(sum(out)).toBe(100);
    expect(out.every((x) => x >= 0)).toBe(true);
  });

  it("already-100 [50,30,20] preserved, sum 100", () => {
    expect(normalizeWeightsTo100([50, 30, 20])).toEqual([50, 30, 20]);
  });

  it("all-zero [0,0,0,0] → even spread, sum 100", () => {
    const out = normalizeWeightsTo100([0, 0, 0, 0]);
    expect(sum(out)).toBe(100);
    expect(out).toEqual([25, 25, 25, 25]);
  });

  it("negatives/NaN treated as 0", () => {
    const out = normalizeWeightsTo100([-5, 50, Number.NaN, 50]);
    expect(sum(out)).toBe(100);
    expect(out[0]).toBe(0);
    expect(out[2]).toBe(0);
  });

  it("empty → empty", () => {
    expect(normalizeWeightsTo100([])).toEqual([]);
  });
});

describe("normalizeRatioTo100 (by key)", () => {
  it("normalizes ratioPercent field, sum 100, keeps other fields", () => {
    const pillars = [
      { name: "A", ratioPercent: 40 },
      { name: "B", ratioPercent: 40 },
      { name: "C", ratioPercent: 40 },
    ];
    const out = normalizeRatioTo100(pillars, "ratioPercent");
    expect(sum(out.map((p) => p.ratioPercent))).toBe(100);
    expect(out.map((p) => p.name)).toEqual(["A", "B", "C"]);
  });
});

describe("normalizeRecordTo100 (objectiveMix)", () => {
  it("normalizes record values, sum 100, preserves keys", () => {
    const mix = { seo: 10, educate: 30, trust: 20, conversion: 15, story: 15, community: 15 };
    const out = normalizeRecordTo100(mix);
    expect(sum(Object.values(out))).toBe(100);
    expect(Object.keys(out)).toEqual(Object.keys(mix));
  });
});
