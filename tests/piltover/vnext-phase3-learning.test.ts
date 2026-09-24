import { afterEach, describe, expect, it } from "vitest";
import { deriveMetrics, evaluateMeasurementEligibility, getPerformanceOverview, recordPerformanceSnapshot } from "../../lib/piltover/vnext/measurement-engine";
import { analyzeExperiment } from "../../lib/piltover/vnext/experiment-engine";
import { compareEvalRuns, runEvalSuite } from "../../lib/piltover/vnext/eval-engine";
import { recommendationCanMutateProduction } from "../../lib/piltover/vnext/learning-engine";

describe("Piltover vNext phase 3 learning loop", () => {
  it("derives canonical ratios deterministically", () => {
    expect(deriveMetrics({ impressions: 1000, clicks: 50, spend: 500000, conversions: 5, conversion_value: 1500000, engagement: 120, reach: 600 }))
      .toMatchObject({ ctr: 5, cpc: 10000, cpa: 100000, roas: 3, engagement_rate: 20 });
  });

  it("gates MMM until sufficient longitudinal multichannel evidence exists", () => {
    const weak = evaluateMeasurementEligibility({ observationCount: 10, distinctPeriods: 8, experimentCount: 0, channelCount: 1, hasSpend: true, hasOutcome: true });
    expect(weak.find((row) => row.mode === "MMM")).toMatchObject({ eligible: false });
    const mature = evaluateMeasurementEligibility({ observationCount: 500, distinctPeriods: 60, experimentCount: 4, channelCount: 3, hasSpend: true, hasOutcome: true });
    expect(mature.find((row) => row.mode === "MMM")).toMatchObject({ eligible: true });
  });

  it("does not declare a winner when sample is insufficient", () => {
    const result = analyzeExperiment({ control: { id: "a", n: 5, mean: 10 }, variants: [{ id: "b", n: 5, mean: 20 }] });
    expect(result.results[0].decision).toBe("INCONCLUSIVE");
  });

  it("labels meaningful lift only after sample threshold", () => {
    const result = analyzeExperiment({ control: { id: "a", n: 100, mean: 10 }, variants: [{ id: "b", n: 100, mean: 12 }] });
    expect(result.results[0]).toMatchObject({ decision: "PROMISING", sufficientSample: true, meaningfulLift: true });
  });

  it("requires human acceptance before a recommendation can mutate production", () => {
    expect(recommendationCanMutateProduction("PROPOSED")).toBe(false);
    expect(recommendationCanMutateProduction("REJECTED")).toBe(false);
    expect(recommendationCanMutateProduction("ACCEPTED")).toBe(true);
  });

  it("runs eval suites and detects regressions", async () => {
    const suite = await runEvalSuite({
      cases: [{ id: "nonempty", input: "hello", evaluate: (output: string) => ({ passed: output.length > 0, score: output.length > 0 ? 1 : 0, reasons: [] }) }],
      runner: async (value) => value.toUpperCase(),
    });
    expect(suite).toMatchObject({ passed: true, score: 1 });
    expect(compareEvalRuns({ score: 0.9 }, { score: 0.7 }, 0.05)).toMatchObject({ regressed: true });
  });
});

import { createP3Fixture, type P3Fixture } from "./p3-test-db";
import { persistEvaluationRun } from "../../lib/piltover/vnext/evaluation-service";
import { promotePromptVersion, registerPromptVersion } from "../../lib/piltover/vnext/registry-service";

let integrationFixture: P3Fixture | null = null;

async function setupIntegration() {
  integrationFixture = await createP3Fixture();
  const { db } = integrationFixture;
  await db.userProfile.create({ data: { id: "local", name: "Local" } });
  await db.brandDNA.create({
    data: {
      id: "dna-local",
      userId: "local",
      organizationId: "org-a",
      brandId: "brand-a1",
    },
  });
  return integrationFixture;
}

afterEach(async () => {
  if (integrationFixture) await integrationFixture.database.dispose();
  integrationFixture = null;
});

describe("Piltover vNext phase 3 persistence gates", () => {
  it("scopes canonical performance snapshots to the active tenant", async () => {
    const { db } = await setupIntegration();
    const own = await recordPerformanceSnapshot(db, {
      entityType: "campaign",
      entityId: "campaign-a",
      period: "2026-W38",
      metrics: { impressions: 1000, clicks: 50 },
      source: "test",
    });
    await db.performanceSnapshot.create({
      data: {
        id: "foreign-snapshot",
        organizationId: "org-b",
        workspaceId: "workspace-b",
        brandId: "brand-b1",
        entityType: "campaign",
        entityId: "campaign-b",
        period: "2026-W38",
        metrics: { impressions: 999999 },
        source: "test",
        capturedAt: new Date(),
      },
    });
    const overview = await getPerformanceOverview(db);
    expect(overview.snapshots.map((row) => row.id)).toContain(own.id);
    expect(overview.snapshots.map((row) => row.id)).not.toContain("foreign-snapshot");
  });

  it("persists evaluation outcomes and requires a passing eval before prompt promotion", async () => {
    const { db } = await setupIntegration();
    const candidate = await registerPromptVersion(db, {
      key: "phase3-gated-prompt",
      name: "Phase 3 gated prompt",
      system: "candidate",
      status: "TESTING",
    });

    await expect(promotePromptVersion(db, candidate.id)).rejects.toThrow("PASSING_EVALUATION_REQUIRED");

    const evaluation = await persistEvaluationRun(db, {
      subjectType: "PROMPT_VERSION",
      subjectRef: "phase3-gated-prompt",
      candidateRef: candidate.id,
      score: 0.95,
      result: { passed: true },
    });
    expect(evaluation.status).toBe("PASSED");

    const promoted = await promotePromptVersion(db, candidate.id);
    expect(promoted.status).toBe("PRODUCTION");
  });
});
