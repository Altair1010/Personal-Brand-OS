import { describe, it, expect } from "vitest";
import { runModule, type PromptModule } from "@/lib/ai/run";
import { strategyModule } from "@/lib/prompts/strategy";
import type { AIAdapter } from "@/lib/ai/adapter";

const OBJ = { seo: 10, educate: 35, trust: 25, conversion: 15, story: 10, community: 5 };

function week(i: number) {
  return {
    weekIndex: i,
    theme: `Tuần ${i}`,
    focusPillar: "Giáo dục quản trị rủi ro",
    objectivesMix: OBJ,
  };
}

// 5 weeklyThemes → hợp lệ.
const VALID_OUTPUT = JSON.stringify({
  contentRatio: OBJ,
  weeklyThemes: [week(1), week(2), week(3), week(4), week(5)],
  ctaPlan: [{ stage: "nhận biết", cta: "Theo dõi", when: "tuần 1" }],
  topicMap: [{ pillar: "Giáo dục quản trị rủi ro", topics: ["quản trị vốn"] }],
  recommendedTemplates: ["nhật ký lệnh"],
  kpiToTrack: ["reach"],
  doNotList: ["hứa lợi nhuận"],
  assumptions: [],
});

// Chỉ 3 weeklyThemes → fails .length(5), triggers repair.
const INVALID_OUTPUT = JSON.stringify({
  contentRatio: OBJ,
  weeklyThemes: [week(1), week(2), week(3)],
  ctaPlan: [],
  topicMap: [],
  recommendedTemplates: [],
  kpiToTrack: [],
  doNotList: [],
  assumptions: [],
});

const INPUT = {
  brandDna: { positioning: "Người dẫn đường XAUUSD kỷ luật", field: "giao dịch vàng" },
  goal: { name: "Ra mắt khóa học", goalType: "conversion" },
  personas: [{ name: "Trader mới" }],
  pillars: [{ name: "Giáo dục quản trị rủi ro" }, { name: "Chuyển đổi khóa học" }],
};

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

const mod = strategyModule as PromptModule<unknown, unknown>;

describe("strategy module pipeline", () => {
  it("(a) valid JSON with 5 weeklyThemes → ok, contentRatio normalized to 100", async () => {
    const adapter = mockAdapter([VALID_OUTPUT]);
    const result = await runModule(mod, INPUT, { adapter });
    expect(result.ok).toBe(true);
    expect(result.status).toBe("ok");
    if (result.ok) {
      const data = result.data as {
        weeklyThemes: unknown[];
        contentRatio: Record<string, number>;
      };
      expect(data.weeklyThemes).toHaveLength(5);
      const sum = Object.values(data.contentRatio).reduce((a, b) => a + b, 0);
      expect(sum).toBe(100);
    }
    expect(adapter.calls).toBe(1);
  });

  it("(b) invalid (3 themes) then valid → repair path, adapter called twice, ok", async () => {
    const adapter = mockAdapter([INVALID_OUTPUT, VALID_OUTPUT]);
    const result = await runModule(mod, INPUT, { adapter });
    expect(result.ok).toBe(true);
    expect(result.status).toBe("ok");
    expect(adapter.calls).toBe(2);
  });

  it("(c) non-JSON garbage both calls → ok false, invalid_json, no throw", async () => {
    const adapter = mockAdapter(["not json", "still garbage"]);
    const result = await runModule(mod, INPUT, { adapter });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("invalid_json");
    expect(adapter.calls).toBe(2);
  });
});
