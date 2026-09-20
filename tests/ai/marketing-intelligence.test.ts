import { describe, expect, it } from "vitest";
import type { AIAdapter } from "@/lib/ai/adapter";
import { runModule } from "@/lib/ai/run";

import {
  marketingIntelligenceInputSchema,
  marketingIntelligenceOutputSchema,
  marketingIntelligenceModule,
  validateMarketingIntelligenceEvidenceRefs,
} from "@/lib/prompts/marketing-intelligence";

const input = marketingIntelligenceInputSchema.parse({
  period: "30 days",
  strategy: {
    versionId: "sv1",
    name: "Growth",
    objective: "conversion",
  },
  organic: [
    {
      refId: "post-1",
      title: "Organic proof",
      reach: 1200,
      engagement: 140,
      comments: 20,
      saves: 18,
      source: "manual",
    },
  ],
  paid: [
    {
      refId: "ads-1",
      campaignName: "Meta conversion test",
      state: "EXTERNAL_NOT_CONNECTED",
      spendMinor: 120000,
      impressions: 5000,
      reach: 4100,
      clicks: 230,
      linkClicks: 180,
      conversions: 12,
      conversionValueMinor: null,
      source: "MANUAL",
    },
  ],
});

describe("marketing intelligence evidence contract", () => {
  it("renders Organic and Paid evidence while preserving provider truth", () => {
    const prompt = marketingIntelligenceModule.buildUser(input);
    expect(prompt).toContain("ref=post-1");
    expect(prompt).toContain("ref=ads-1");
    expect(prompt).toContain("state=EXTERNAL_NOT_CONNECTED");
    expect(prompt).toContain("spendMinor=120000");
  });

  it("accepts only output evidence refs that exist in the input", () => {
    const output = marketingIntelligenceOutputSchema.parse({
      insights: [
        {
          scope: "cross_channel",
          finding: "Both channels have recorded reach.",
          evidence: "Organic reach=1200; Paid reach=4100.",
          evidenceRefs: ["post-1", "ads-1"],
          recommendation: "Collect another comparable period before changing allocation.",
          confidence: "low",
        },
      ],
      warnings: ["Paid source is manual and provider is not connected."],
    });
    expect(validateMarketingIntelligenceEvidenceRefs(input, output)).toEqual({ ok: true });
  });

  it("rejects fabricated evidence refs before persistence", () => {
    const output = marketingIntelligenceOutputSchema.parse({
      insights: [
        {
          scope: "paid",
          finding: "Claim",
          evidence: "Unsupported",
          evidenceRefs: ["ads-made-up"],
          recommendation: "Do nothing.",
          confidence: "low",
        },
      ],
      warnings: [],
    });
    expect(validateMarketingIntelligenceEvidenceRefs(input, output)).toEqual({
      ok: false,
      invalidRefs: ["ads-made-up"],
    });
  });
});

describe("marketing intelligence AI runtime", () => {
  it("runs through the structured AI adapter path with claim-matched evidence", async () => {
    const adapter = {
      async call() {
        return { text: "unused" };
      },
      async callStructured() {
        return {
          object: {
            insights: [
              {
                scope: "cross_channel",
                finding: "Organic and Paid both have recorded reach.",
                evidence: "Organic reach=1200; Paid reach=4100; Paid spendMinor=120000.",
                evidenceRefs: ["post-1", "ads-1"],
                recommendation: "Collect a second comparable period before reallocating spend.",
                confidence: "low",
              },
            ],
            warnings: ["Meta provider is not connected; Paid metrics are manual evidence."],
          },
          tokensIn: 100,
          tokensOut: 60,
        };
      },
    } as AIAdapter;

    const result = await runModule(marketingIntelligenceModule, input, { adapter });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(validateMarketingIntelligenceEvidenceRefs(input, result.data)).toEqual({ ok: true });
    expect(result.data.insights[0].scope).toBe("cross_channel");
  });
});
