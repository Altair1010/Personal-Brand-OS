import { describe, it, expect } from "vitest";
import { runModule, type PromptModule } from "@/lib/ai/run";
import {
  performanceModule,
  enforceLowConfidence,
  type PerformanceOutput,
} from "@/lib/prompts/performance";
import type { AIAdapter } from "@/lib/ai/adapter";

function post(id: string) {
  return {
    id,
    objective: "educate",
    pillar: "Bằng chứng thực chiến",
    hookStyle: "question",
    ctaIntensity: "soft",
    format: "carousel",
    metrics: {
      reach: 1200,
      engagement: 180,
      comments: 12,
      saves: 24,
      daysSincePost: 5,
    },
  };
}

const INPUT = {
  posts: [post("p1"), post("p2"), post("p3")],
  period: "30 ngày gần nhất",
};

const VALID_OUTPUT = JSON.stringify({
  insights: [
    {
      scope: "format",
      refId: "carousel",
      finding: "Carousel giữ chân tốt",
      evidence: "p1 saves=24, engagement=180",
      recommendation: "Ưu tiên carousel",
      confidence: "normal",
    },
  ],
  topPosts: ["p1"],
  weakPillars: [],
  warnings: [],
});

// evidence="" vi phạm .min(1) → repair path.
const INVALID_OUTPUT = JSON.stringify({
  insights: [
    {
      scope: "format",
      finding: "Thiếu bằng chứng",
      evidence: "",
      recommendation: "x",
      confidence: "normal",
    },
  ],
  topPosts: [],
  weakPillars: [],
  warnings: [],
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

const mod = performanceModule as PromptModule<unknown, unknown>;

describe("performance module pipeline", () => {
  it("(a) valid output on first call → ok, status ok, 1 call", async () => {
    const adapter = mockAdapter([VALID_OUTPUT]);
    const result = await runModule(mod, INPUT, { adapter });
    expect(result.ok).toBe(true);
    expect(result.status).toBe("ok");
    if (result.ok) {
      const data = result.data as PerformanceOutput;
      expect(data.insights).toHaveLength(1);
    }
    expect(adapter.calls).toBe(1);
  });

  it("(b) invalid (empty evidence) then valid → repair path, 2 calls, ok", async () => {
    const adapter = mockAdapter([INVALID_OUTPUT, VALID_OUTPUT]);
    const result = await runModule(mod, INPUT, { adapter });
    expect(result.ok).toBe(true);
    expect(adapter.calls).toBe(2);
  });

  it("(c) garbage both calls → invalid_json, no throw, 2 calls", async () => {
    const adapter = mockAdapter(["nope", "still nope"]);
    const result = await runModule(mod, INPUT, { adapter });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("invalid_json");
    expect(adapter.calls).toBe(2);
  });
});

describe("enforceLowConfidence", () => {
  const out: PerformanceOutput = {
    insights: [
      {
        scope: "format",
        finding: "a",
        evidence: "b",
        recommendation: "c",
        confidence: "normal",
      },
      {
        scope: "pillar",
        finding: "d",
        evidence: "e",
        recommendation: "f",
        confidence: "normal",
      },
    ],
    topPosts: [],
    weakPillars: [],
    warnings: [],
  };

  it("postCount=2 (<3) → mọi insight confidence=low", () => {
    const res = enforceLowConfidence(out, 2);
    expect(res.insights.every((i) => i.confidence === "low")).toBe(true);
  });

  it("postCount=3 → giữ nguyên confidence", () => {
    const res = enforceLowConfidence(out, 3);
    expect(res.insights.every((i) => i.confidence === "normal")).toBe(true);
  });
});
