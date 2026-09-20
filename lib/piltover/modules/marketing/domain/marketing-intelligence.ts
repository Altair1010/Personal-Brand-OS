import { z } from "zod";

const metric = z.number().nullable().optional();
const nonBlank = z.string().trim().min(1);

export const MarketingIntelligenceEvidenceSchema = z.object({
  period: nonBlank,
  strategy: z.object({
    versionId: z.string().nullable(),
    name: z.string().nullable(),
    objective: z.string().nullable(),
  }),
  organic: z.array(z.object({
    refId: nonBlank,
    title: nonBlank,
    reach: metric,
    engagement: metric,
    comments: metric,
    saves: metric,
    source: nonBlank,
  })),
  paid: z.array(z.object({
    refId: nonBlank,
    campaignName: nonBlank,
    state: nonBlank,
    spendMinor: metric,
    impressions: metric,
    reach: metric,
    clicks: metric,
    linkClicks: metric,
    conversions: metric,
    conversionValueMinor: metric,
    source: nonBlank,
  })),
}).strict();

export const MarketingIntelligenceResultSchema = z.object({
  insights: z.array(z.object({
    scope: z.enum(["organic", "paid", "cross_channel", "strategy"]),
    refId: z.string().optional(),
    finding: nonBlank,
    evidence: nonBlank,
    evidenceRefs: z.array(nonBlank).min(1),
    recommendation: nonBlank,
    confidence: z.enum(["low", "normal"]),
  })),
  warnings: z.array(z.string()),
}).strict();

export type MarketingIntelligenceEvidence = z.infer<typeof MarketingIntelligenceEvidenceSchema>;
export type MarketingIntelligenceResult = z.infer<typeof MarketingIntelligenceResultSchema>;

export function validateMarketingIntelligenceEvidenceRefs(
  input: MarketingIntelligenceEvidence,
  output: MarketingIntelligenceResult,
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
  return invalidRefs.length === 0 ? { ok: true } : { ok: false, invalidRefs };
}
