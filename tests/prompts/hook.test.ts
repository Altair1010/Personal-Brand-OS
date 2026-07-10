import { describe, it, expect } from "vitest";
import { runModule, type PromptModule } from "@/lib/ai/run";
import { hookModule } from "@/lib/prompts/hook";
import { HOOK_STYLES } from "@/lib/constants";
import type { AIAdapter } from "@/lib/ai/adapter";

const VALID_OUTPUT = JSON.stringify({
  hooks: [
    { text: "90% trader bỏ lỡ điều này khi vào lệnh vàng.", style: "curiosity" },
    { text: "Tôi đã cháy tài khoản 3 lần trước khi hiểu điều này.", style: "story" },
    { text: "Đừng vào lệnh XAUUSD nếu chưa biết điều này.", style: "contrarian" },
    { text: "Bạn có đang mắc sai lầm khi đặt stop loss không?", style: "question" },
    { text: "Nỗi đau lớn nhất của trader mới là gì?", style: "pain" },
  ],
});

// Wrong style value → triggers repair
const INVALID_OUTPUT = JSON.stringify({
  hooks: [
    { text: "Hook hay đó.", style: "WRONG_STYLE" },
  ],
});

const VALID_INPUT = {
  topic: "Quản trị rủi ro khi giao dịch XAUUSD",
  objectiveKey: "educate",
  persona: { name: "Trader mới", pain: "Hay cắt lỗ sai chỗ" },
  count: 5,
};

function mockAdapter(responses: string[]): AIAdapter & { calls: number } {
  const adapter = {
    calls: 0,
    async call() {
      const text = responses[Math.min(adapter.calls, responses.length - 1)];
      adapter.calls += 1;
      return { text, tokensIn: 80, tokensOut: 60 };
    },
  };
  return adapter;
}

const mod = hookModule as PromptModule<unknown, unknown>;

describe("hook module pipeline", () => {
  it("(a) valid output → ok, all styles in HOOK_STYLES, no duplicate text", async () => {
    const adapter = mockAdapter([VALID_OUTPUT]);
    const result = await runModule(mod, VALID_INPUT, { adapter });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("ok");
    expect(adapter.calls).toBe(1);

    if (result.ok) {
      const data = result.data as { hooks: { text: string; style: string }[] };
      expect(data.hooks.length).toBeGreaterThan(0);

      // All styles must be in HOOK_STYLES
      for (const h of data.hooks) {
        expect(HOOK_STYLES as readonly string[]).toContain(h.style);
      }

      // No duplicate text
      const texts = data.hooks.map((h) => h.text);
      const unique = new Set(texts);
      expect(unique.size).toBe(texts.length);
    }
  });

  it("(b) invalid style → repair path, adapter called twice, ok", async () => {
    const adapter = mockAdapter([INVALID_OUTPUT, VALID_OUTPUT]);
    const result = await runModule(mod, VALID_INPUT, { adapter });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("ok");
    expect(adapter.calls).toBe(2);
  });

  it("(c) garbage both calls → ok false, invalid_json", async () => {
    const adapter = mockAdapter(["không phải json", "cũng vậy"]);
    const result = await runModule(mod, VALID_INPUT, { adapter });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("invalid_json");
    expect(adapter.calls).toBe(2);
  });

  it("(d) count clamp — count=0 fails inputSchema validation", async () => {
    const adapter = mockAdapter([VALID_OUTPUT]);
    const badInput = { ...VALID_INPUT, count: 0 };
    const result = await runModule(mod, badInput, { adapter });

    // count min=1, so count=0 → validateInput fails
    expect(result.ok).toBe(false);
    expect(adapter.calls).toBe(0);
  });

  it("(e) all HOOK_STYLES values covered across output", async () => {
    const allStylesOutput = JSON.stringify({
      hooks: HOOK_STYLES.map((style) => ({ text: `Hook cho style ${style}`, style })),
    });
    const adapter = mockAdapter([allStylesOutput]);
    const inputAllStyles = { ...VALID_INPUT, count: HOOK_STYLES.length };
    const result = await runModule(mod, inputAllStyles, { adapter });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { hooks: { text: string; style: string }[] };
      const styles = data.hooks.map((h) => h.style);
      for (const s of HOOK_STYLES) {
        expect(styles).toContain(s);
      }
    }
  });
});
