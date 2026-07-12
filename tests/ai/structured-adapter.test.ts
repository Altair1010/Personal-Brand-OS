import { describe, it, expect } from "vitest";
import { runModule, type PromptModule } from "@/lib/ai/run";
import { brandDnaModule } from "@/lib/prompts/brand-dna";
import type { AIAdapter } from "@/lib/ai/adapter";

// Structured path (Vercel AI SDK generateObject) — run.ts prefers adapter.callStructured when
// present. These mocks exercise that branch WITHOUT hitting the network.

const VALID_OBJECT = {
  positioning: "Người dẫn đường giao dịch XAUUSD kỷ luật",
  threeWords: ["kỷ luật", "minh bạch", "thực chiến"],
  differentiationSharpened: "Tập trung quản trị rủi ro",
  voiceTraits: ["thẳng thắn"],
  suggestedEducationTopics: ["quản trị vốn"],
  gaps: [],
  assumptions: [],
};

const INPUT = { whoAmI: "chuyên gia trading vàng", field: "giao dịch XAUUSD" };

// Adapter exposing callStructured; `call` is a stub that must NOT be reached on this path.
function structuredAdapter(
  behavior: { object?: unknown; throws?: string },
): AIAdapter & { structuredCalls: number; textCalls: number } {
  const adapter = {
    structuredCalls: 0,
    textCalls: 0,
    async call() {
      adapter.textCalls += 1;
      return { text: "should-not-be-used" };
    },
    async callStructured() {
      adapter.structuredCalls += 1;
      if (behavior.throws) throw new Error(behavior.throws);
      return { object: behavior.object, tokensIn: 120, tokensOut: 60 };
    },
  };
  return adapter as AIAdapter & { structuredCalls: number; textCalls: number };
}

const mod = brandDnaModule as PromptModule<unknown, unknown>;

describe("structured (generateObject) adapter path", () => {
  it("(a) callStructured returns valid object → ok, uses structured path, not text", async () => {
    const adapter = structuredAdapter({ object: VALID_OBJECT });
    const result = await runModule(mod, INPUT, { adapter });
    expect(result.ok).toBe(true);
    expect(result.status).toBe("ok");
    if (result.ok) {
      const data = result.data as { threeWords: string[] };
      expect(data.threeWords).toHaveLength(3);
    }
    expect(adapter.structuredCalls).toBe(1);
    expect(adapter.textCalls).toBe(0);
  });

  it("(b) callStructured throws (no schema-valid object) → ok false, invalid_json, no crash", async () => {
    const adapter = structuredAdapter({ throws: "NoObjectGeneratedError" });
    const result = await runModule(mod, INPUT, { adapter });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("invalid_json");
    expect(adapter.structuredCalls).toBe(1);
  });

  it("(c) callStructured returns schema-invalid object (missing field) → invalid_json", async () => {
    // Missing "positioning" — re-validation in run.ts must reject it even from a mock.
    const { positioning: _drop, ...bad } = VALID_OBJECT;
    void _drop;
    const adapter = structuredAdapter({ object: bad });
    const result = await runModule(mod, INPUT, { adapter });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("invalid_json");
  });
});
