import { describe, it, expect } from "vitest";
import { runModule, type PromptModule } from "@/lib/ai/run";
import { audienceModule } from "@/lib/prompts/audience";
import type { AIAdapter } from "@/lib/ai/adapter";

function persona(name: string) {
  return {
    name,
    pain: "thua lỗ liên tục",
    falseBelief: "cần tín hiệu chuẩn là thắng",
    fear: "mất hết vốn",
    desire: "giao dịch có hệ thống",
    language: "đời thường",
    contentAngle: "quản trị rủi ro",
    cta: "đăng ký học thử",
    offer: "khóa nền tảng",
  };
}

const VALID_OUTPUT = JSON.stringify({
  personas: [persona("Nhà giao dịch mới"), persona("Nhà đầu tư bận rộn"), persona("Trader bán chuyên")],
  assumptions: ["Suy ra từ định vị kỷ luật"],
});

// Only 1 persona → violates .min(2) → triggers repair path.
const INVALID_OUTPUT = JSON.stringify({
  personas: [persona("Chỉ một persona")],
  assumptions: [],
});

const INPUT = {
  brandDna: { whoAmI: "chuyên gia trading vàng", positioning: "kỷ luật" },
  goal: { name: "Bán khóa học", goalType: "conversion" },
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

const mod = audienceModule as PromptModule<unknown, unknown>;

describe("audience module pipeline", () => {
  it("(a) valid 3 personas on first call → ok", async () => {
    const adapter = mockAdapter([VALID_OUTPUT]);
    const result = await runModule(mod, INPUT, { adapter });
    expect(result.ok).toBe(true);
    expect(result.status).toBe("ok");
    if (result.ok) {
      const data = result.data as { personas: unknown[] };
      expect(data.personas).toHaveLength(3);
    }
    expect(adapter.calls).toBe(1);
  });

  it("(b) invalid (1 persona) then valid → repair path, called twice, ok", async () => {
    const adapter = mockAdapter([INVALID_OUTPUT, VALID_OUTPUT]);
    const result = await runModule(mod, INPUT, { adapter });
    expect(result.ok).toBe(true);
    expect(result.status).toBe("ok");
    expect(adapter.calls).toBe(2);
  });

  it("(c) garbage both calls → invalid_json, no throw", async () => {
    const adapter = mockAdapter(["not json", "still garbage"]);
    const result = await runModule(mod, INPUT, { adapter });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("invalid_json");
    expect(adapter.calls).toBe(2);
  });
});
