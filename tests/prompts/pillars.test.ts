import { describe, it, expect } from "vitest";
import { runModule, type PromptModule } from "@/lib/ai/run";
import { pillarsModule } from "@/lib/prompts/pillars";
import { OBJECTIVES } from "@/lib/constants";
import type { AIAdapter } from "@/lib/ai/adapter";

function mix(vals: number[]) {
  return Object.fromEntries(OBJECTIVES.map((k, i) => [k, vals[i]]));
}

function pillar(name: string, ratioPercent: number, mixVals: number[]) {
  return {
    name,
    description: `mô tả ${name}`,
    ratioPercent,
    objectiveMix: mix(mixVals),
  };
}

const VALID_OUTPUT = JSON.stringify({
  pillars: [
    pillar("Giáo dục", 40, [10, 50, 20, 5, 5, 10]),
    pillar("Bằng chứng", 35, [5, 20, 45, 10, 15, 5]),
    pillar("Chuyển đổi", 25, [5, 15, 15, 50, 10, 5]),
  ],
  rationale: "Cân bằng giáo dục, niềm tin, chuyển đổi",
  assumptions: [],
});

// Only 2 pillars → violates .min(3) → triggers repair path.
const INVALID_OUTPUT = JSON.stringify({
  pillars: [
    pillar("Một", 50, [10, 50, 20, 5, 5, 10]),
    pillar("Hai", 50, [5, 20, 45, 10, 15, 5]),
  ],
  rationale: "thiếu",
  assumptions: [],
});

// ratioPercent [40,40,40] (sum 120) and objectiveMix sums ≠ 100 → prove code normalizes.
const SKEWED_OUTPUT = JSON.stringify({
  pillars: [
    pillar("A", 40, [1, 2, 3, 4, 5, 6]),
    pillar("B", 40, [10, 10, 10, 10, 10, 10]),
    pillar("C", 40, [0, 0, 0, 0, 0, 200]),
  ],
  rationale: "lệch có chủ đích",
  assumptions: [],
});

const INPUT = {
  brandDna: { positioning: "kỷ luật", field: "XAUUSD" },
  goal: { name: "Bán khóa học", goalType: "conversion" },
  personas: [{ name: "Nhà giao dịch mới" }],
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

const mod = pillarsModule as PromptModule<unknown, unknown>;

type Pillar = { ratioPercent: number; objectiveMix: Record<string, number> };

function sum(o: Record<string, number>) {
  return Object.values(o).reduce((a, b) => a + b, 0);
}

describe("pillars module pipeline", () => {
  it("(a) valid 3 pillars on first call → ok, ratio sums 100", async () => {
    const adapter = mockAdapter([VALID_OUTPUT]);
    const result = await runModule(mod, INPUT, { adapter });
    expect(result.ok).toBe(true);
    expect(result.status).toBe("ok");
    if (result.ok) {
      const data = result.data as { pillars: Pillar[] };
      expect(data.pillars).toHaveLength(3);
      expect(data.pillars.reduce((a, p) => a + p.ratioPercent, 0)).toBe(100);
    }
    expect(adapter.calls).toBe(1);
  });

  it("(b) invalid (2 pillars) then valid → repair path, called twice, ok", async () => {
    const adapter = mockAdapter([INVALID_OUTPUT, VALID_OUTPUT]);
    const result = await runModule(mod, INPUT, { adapter });
    expect(result.ok).toBe(true);
    expect(adapter.calls).toBe(2);
  });

  it("(c) garbage both calls → invalid_json, no throw", async () => {
    const adapter = mockAdapter(["nope", "still nope"]);
    const result = await runModule(mod, INPUT, { adapter });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("invalid_json");
    expect(adapter.calls).toBe(2);
  });

  it("(d) skewed ratios → code normalizes: ratioPercent SUM=100 and each objectiveMix SUM=100", async () => {
    const adapter = mockAdapter([SKEWED_OUTPUT]);
    const result = await runModule(mod, INPUT, { adapter });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { pillars: Pillar[] };
      expect(data.pillars.reduce((a, p) => a + p.ratioPercent, 0)).toBe(100);
      for (const p of data.pillars) {
        expect(sum(p.objectiveMix)).toBe(100);
        expect(Object.keys(p.objectiveMix).sort()).toEqual([...OBJECTIVES].sort());
      }
    }
  });
});
