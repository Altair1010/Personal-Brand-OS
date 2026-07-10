import { describe, it, expect } from "vitest";
import { runModule, type PromptModule } from "@/lib/ai/run";
import { ctaModule } from "@/lib/prompts/cta";
import { CTA_INTENSITY } from "@/lib/constants";
import type { AIAdapter } from "@/lib/ai/adapter";

const VALID_OUTPUT = JSON.stringify({
  ctas: [
    { text: "Comment 'học' để nhận tài liệu miễn phí nhé.", intensity: "soft" },
    { text: "Nhắn tin cho tôi để được tư vấn cụ thể.", intensity: "medium" },
    { text: "Đăng ký khoá học ngay hôm nay — chỉ còn 5 suất.", intensity: "hard" },
  ],
});

// Wrong intensity value → triggers repair
const INVALID_OUTPUT = JSON.stringify({
  ctas: [
    { text: "Mua ngay đi bạn.", intensity: "WRONG_INTENSITY" },
  ],
});

const VALID_INPUT = {
  objectiveKey: "conversion",
  goal: { mainGoal: "Bán khoá học giao dịch XAUUSD", targetAudience: "trader mới" },
  offer: "Khoá học XAUUSD Mastery 2025",
  intensity: "medium" as const,
};

function mockAdapter(responses: string[]): AIAdapter & { calls: number } {
  const adapter = {
    calls: 0,
    async call() {
      const text = responses[Math.min(adapter.calls, responses.length - 1)];
      adapter.calls += 1;
      return { text, tokensIn: 70, tokensOut: 50 };
    },
  };
  return adapter;
}

const mod = ctaModule as PromptModule<unknown, unknown>;

describe("cta module pipeline", () => {
  it("(a) valid output → ok, all intensity in CTA_INTENSITY", async () => {
    const adapter = mockAdapter([VALID_OUTPUT]);
    const result = await runModule(mod, VALID_INPUT, { adapter });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("ok");
    expect(adapter.calls).toBe(1);

    if (result.ok) {
      const data = result.data as { ctas: { text: string; intensity: string }[] };
      expect(data.ctas.length).toBeGreaterThan(0);

      for (const c of data.ctas) {
        expect(CTA_INTENSITY as readonly string[]).toContain(c.intensity);
        expect(c.text.length).toBeGreaterThan(0);
      }
    }
  });

  it("(b) invalid intensity → repair path, adapter called twice", async () => {
    const adapter = mockAdapter([INVALID_OUTPUT, VALID_OUTPUT]);
    const result = await runModule(mod, VALID_INPUT, { adapter });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("ok");
    expect(adapter.calls).toBe(2);
  });

  it("(c) garbage both calls → ok false, invalid_json", async () => {
    const adapter = mockAdapter(["không json", "vẫn không json"]);
    const result = await runModule(mod, VALID_INPUT, { adapter });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("invalid_json");
    expect(adapter.calls).toBe(2);
  });

  it("(d) all CTA_INTENSITY values present in valid output", async () => {
    const allIntensityOutput = JSON.stringify({
      ctas: CTA_INTENSITY.map((intensity) => ({
        text: `CTA mức ${intensity}`,
        intensity,
      })),
    });
    const adapter = mockAdapter([allIntensityOutput]);
    const result = await runModule(mod, VALID_INPUT, { adapter });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { ctas: { intensity: string }[] };
      const intensities = data.ctas.map((c) => c.intensity);
      for (const i of CTA_INTENSITY) {
        expect(intensities).toContain(i);
      }
    }
  });

  it("(e) invalid objectiveKey → validateInput fails, no adapter call", async () => {
    const adapter = mockAdapter([VALID_OUTPUT]);
    const badInput = { ...VALID_INPUT, objectiveKey: "BAD_KEY" };
    const result = await runModule(mod, badInput, { adapter });

    expect(result.ok).toBe(false);
    expect(adapter.calls).toBe(0);
  });

  it("(f) invalid intensity in input → validateInput fails, no adapter call", async () => {
    const adapter = mockAdapter([VALID_OUTPUT]);
    const badInput = { ...VALID_INPUT, intensity: "INVALID" };
    const result = await runModule(mod, badInput, { adapter });

    expect(result.ok).toBe(false);
    expect(adapter.calls).toBe(0);
  });
});
