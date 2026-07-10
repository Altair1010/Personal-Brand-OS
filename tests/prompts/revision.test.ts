import { describe, it, expect } from "vitest";
import { runModule, type PromptModule } from "@/lib/ai/run";
import {
  revisionModule,
  type RevisionOutput,
} from "@/lib/prompts/revision";
import type { AIAdapter } from "@/lib/ai/adapter";

const INPUT = {
  currentStrategyVersion: {
    version: 1,
    contentRatio: { "Bằng chứng thực chiến": 50, "Giáo dục": 50 },
    weeklyThemes: [{ week: 1, theme: "Khởi động" }],
  },
  insights: [
    {
      scope: "pillar",
      finding: "pillar Bằng chứng thực chiến engagement cao hơn",
      evidence: "avgEngagement 120 vs 60",
      recommendation: "tăng tỉ trọng",
      confidence: "normal",
    },
  ],
  versionPerf: [
    { version: 1, postCount: 6, avgReach: 1000, avgEngagement: 120 },
  ],
  goal: { name: "Xây thương hiệu trading", description: "XAUUSD" },
  weekNumber: 2,
};

const VALID_OUTPUT = JSON.stringify({
  weeklyInsight: "Pillar thực chiến kéo tương tác tốt hơn",
  adjustmentPlan: [
    { change: "Tăng Bằng chứng thực chiến lên 60%", reason: "engagement cao hơn" },
  ],
  nextWeekDirection: "Đẩy mạnh case study thực chiến",
  newExperiments: ["Thử carousel"],
  warnings: [],
  revisedContentRatio: { "Bằng chứng thực chiến": 60, "Giáo dục": 40 },
  reasonForNewVersion: "Tuần 2: dồn tỉ trọng theo dữ liệu version 1",
});

// revisedContentRatio tổng ≠ 100 (70+40=110) → sau normalize phải về đúng 100.
const UNNORMALIZED_OUTPUT = JSON.stringify({
  weeklyInsight: "x",
  adjustmentPlan: [{ change: "a", reason: "b" }],
  nextWeekDirection: "y",
  newExperiments: [],
  warnings: [],
  revisedContentRatio: { "Bằng chứng thực chiến": 70, "Giáo dục": 40 },
  reasonForNewVersion: "Chốt version",
});

// reasonForNewVersion="" vi phạm .min(1) → repair path.
const INVALID_EMPTY_REASON = JSON.stringify({
  weeklyInsight: "x",
  adjustmentPlan: [{ change: "a", reason: "b" }],
  nextWeekDirection: "y",
  newExperiments: [],
  warnings: [],
  revisedContentRatio: { "Bằng chứng thực chiến": 50, "Giáo dục": 50 },
  reasonForNewVersion: "",
});

function mockAdapter(responses: string[]): AIAdapter & { calls: number } {
  const adapter = {
    calls: 0,
    async call() {
      const text = responses[Math.min(adapter.calls, responses.length - 1)];
      adapter.calls += 1;
      return { text, tokensIn: 100, tokensOut: 50 };
    },
  };
  return adapter;
}

function ratioSum(r: Record<string, number>): number {
  return Object.values(r).reduce((a, b) => a + b, 0);
}

const mod = revisionModule as PromptModule<unknown, unknown>;

describe("revision module pipeline", () => {
  it("(a) valid output on first call → ok, đúng schema, 1 call", async () => {
    const adapter = mockAdapter([VALID_OUTPUT]);
    const result = await runModule(mod, INPUT, { adapter });
    expect(result.ok).toBe(true);
    expect(result.status).toBe("ok");
    if (result.ok) {
      const data = result.data as RevisionOutput;
      expect(data.adjustmentPlan.length).toBeGreaterThanOrEqual(1);
      expect(data.reasonForNewVersion.length).toBeGreaterThan(0);
    }
    expect(adapter.calls).toBe(1);
  });

  it("(b) invalid (reason rỗng) lần 1 → valid lần 2 → repair path, 2 calls, ok", async () => {
    const adapter = mockAdapter([INVALID_EMPTY_REASON, VALID_OUTPUT]);
    const result = await runModule(mod, INPUT, { adapter });
    expect(result.ok).toBe(true);
    expect(adapter.calls).toBe(2);
  });

  it("(c) revisedContentRatio tổng ≠ 100 → sau normalize sum === 100", async () => {
    const adapter = mockAdapter([UNNORMALIZED_OUTPUT]);
    const result = await runModule(mod, INPUT, { adapter });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as RevisionOutput;
      expect(ratioSum(data.revisedContentRatio)).toBe(100);
    }
  });

  it("(d) reason rỗng cả 2 lần → outputSchema chặn → ok=false, invalid_json", async () => {
    const adapter = mockAdapter([INVALID_EMPTY_REASON, INVALID_EMPTY_REASON]);
    const result = await runModule(mod, INPUT, { adapter });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("invalid_json");
    expect(adapter.calls).toBe(2);
  });

  it("(e) Eval check: sum(revisedContentRatio)===100 && reasonForNewVersion.length>0", async () => {
    const adapter = mockAdapter([VALID_OUTPUT]);
    const result = await runModule(mod, INPUT, { adapter });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as RevisionOutput;
      const evalPass =
        ratioSum(data.revisedContentRatio) === 100 &&
        data.reasonForNewVersion.length > 0;
      expect(evalPass).toBe(true);
    }
  });
});
