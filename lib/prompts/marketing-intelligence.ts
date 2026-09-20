import { z } from "zod";
import { sanitizeExternal } from "@/lib/ai/sanitize";
import type { PromptModule } from "@/lib/ai/run";

const metric = z.number().nullable().optional();

const organicEvidenceSchema = z.object({
  refId: z.string(),
  title: z.string(),
  reach: metric,
  engagement: metric,
  comments: metric,
  saves: metric,
  source: z.string(),
});

const paidEvidenceSchema = z.object({
  refId: z.string(),
  campaignName: z.string(),
  state: z.string(),
  spendMinor: metric,
  impressions: metric,
  reach: metric,
  clicks: metric,
  linkClicks: metric,
  conversions: metric,
  conversionValueMinor: metric,
  source: z.string(),
});

export const marketingIntelligenceInputSchema = z.object({
  period: z.string(),
  strategy: z.object({
    versionId: z.string().nullable(),
    name: z.string().nullable(),
    objective: z.string().nullable(),
  }),
  organic: z.array(organicEvidenceSchema),
  paid: z.array(paidEvidenceSchema),
});
export const MARKETING_INTELLIGENCE_SCOPES = [
  "organic",
  "paid",
  "cross_channel",
  "strategy",
] as const;

const insightSchema = z.object({
  scope: z.enum(MARKETING_INTELLIGENCE_SCOPES),
  refId: z.string().optional(),
  finding: z.string().min(1),
  evidence: z.string().min(1),
  evidenceRefs: z.array(z.string()).min(1),
  recommendation: z.string().min(1),
  confidence: z.enum(["low", "normal"]),
});

export const marketingIntelligenceOutputSchema = z.object({
  insights: z.array(insightSchema),
  warnings: z.array(z.string()),
});

export type MarketingIntelligenceInput = z.infer<typeof marketingIntelligenceInputSchema>;
export type MarketingIntelligenceOutput = z.infer<typeof marketingIntelligenceOutputSchema>;

const SYSTEM = `You are Piltover's marketing performance analyst.
Analyze Organic and Paid evidence together, but never invent metrics, attribution, causality, or live-provider state.

Rules:
- Every finding must cite one or more exact evidenceRefs that exist in the input.
- Evidence text must quote actual numeric values from the input.
- EXTERNAL_NOT_CONNECTED means the paid campaign is not proven to be live on Meta.
- Manual metrics are valid evidence of the entered numbers, but not proof of provider delivery.
- Cross-channel comparisons are descriptive unless the evidence supports a stronger claim.
- Recommendations must be bounded next actions, not autonomous budget or publishing mutations.
- If data is sparse, mixed-source, or incomparable, use confidence=low and explain the limitation.
- scope must be one of: organic, paid, cross_channel, strategy.
Return JSON matching the schema only.`;
function value(v: number | null | undefined): string {
  return v == null ? "NA" : String(v);
}

export const marketingIntelligenceModule: PromptModule<
  MarketingIntelligenceInput,
  MarketingIntelligenceOutput
> = {
  key: "marketing-intelligence",
  role: "marketing performance analyst",
  temperature: 0.2,
  system: SYSTEM,
  inputSchema: marketingIntelligenceInputSchema,
  outputSchema: marketingIntelligenceOutputSchema,
  buildUser(input) {
    const period = sanitizeExternal(input.period, "paste");
    const strategyName = sanitizeExternal(input.strategy.name ?? "unknown", "paste");
    const strategyObjective = sanitizeExternal(input.strategy.objective ?? "unknown", "paste");

    const organic = input.organic.map((row) =>
      [
        `ref=${row.refId}`,
        `title=${sanitizeExternal(row.title, "paste")}`,
        `reach=${value(row.reach)}`,
        `engagement=${value(row.engagement)}`,
        `comments=${value(row.comments)}`,
        `saves=${value(row.saves)}`,
        `source=${sanitizeExternal(row.source, "paste")}`,
      ].join(" | "),
    ).join("\n");

    const paid = input.paid.map((row) =>
      [
        `ref=${row.refId}`,
        `campaign=${sanitizeExternal(row.campaignName, "paste")}`,
        `state=${row.state}`,
        `spendMinor=${value(row.spendMinor)}`,
        `impressions=${value(row.impressions)}`,
        `reach=${value(row.reach)}`,
        `clicks=${value(row.clicks)}`,
        `linkClicks=${value(row.linkClicks)}`,
        `conversions=${value(row.conversions)}`,
        `conversionValueMinor=${value(row.conversionValueMinor)}`,
        `source=${sanitizeExternal(row.source, "paste")}`,
      ].join(" | "),
    ).join("\n");

    return [
      `period=${period}`,
      `strategyVersionId=${input.strategy.versionId ?? "none"}`,
      `strategyName=${strategyName}`,
      `strategyObjective=${strategyObjective}`,
      "",
      "ORGANIC EVIDENCE",
      organic || "none",
      "",
      "PAID EVIDENCE",
      paid || "none",
    ].join("\n");
  },
};

export function validateMarketingIntelligenceEvidenceRefs(
  input: MarketingIntelligenceInput,
  output: MarketingIntelligenceOutput,
): { ok: true } | { ok: false; invalidRefs: string[] } {
  const allowed = new Set([
    ...input.organic.map((row) => row.refId),
    ...input.paid.map((row) => row.refId),
  ]);
  const invalidRefs = [...new Set(
    output.insights.flatMap((insight) =>
      insight.evidenceRefs.filter((ref) => !allowed.has(ref)),
    ),
  )];
  return invalidRefs.length === 0
    ? { ok: true }
    : { ok: false, invalidRefs };
}
