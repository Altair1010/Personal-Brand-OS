import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");
const read = (relative: string) =>
  fs.readFileSync(path.join(root, relative), "utf8");

describe("H1.3 agent-routed intelligence contract", () => {
  it("routes marketing intelligence through Agent Control Plane, not direct model APIs", () => {
    const actions = read("app/(dashboard)/performance/actions.ts");
    expect(actions).toContain("AgentExecutionGateway");
    expect(actions).toContain("PrismaJobQueue");
    expect(actions).toContain('roleRef: "role:marketing-intelligence@h1"');
    expect(actions).not.toContain("runModule(marketingIntelligence");
    expect(actions).not.toContain("resolveModelConfig");
  });

  it("models OAuth and OpenClaw as execution routes", () => {
    const gateway = read(
      "lib/piltover/modules/agents/application/agent-execution-gateway.ts",
    );
    expect(gateway).toContain('z.literal("OAUTH")');
    expect(gateway).toContain('z.literal("OPENCLAW")');
    expect(gateway).toContain('"agent.execute.oauth"');
    expect(gateway).toContain('"agent.execute.openclaw"');
  });

  it("keeps Termius and 9router subordinate to OpenClaw support", () => {
    const gateway = read(
      "lib/piltover/modules/agents/application/agent-execution-gateway.ts",
    );
    expect(gateway).toContain("termius");
    expect(gateway).toContain("router9");
    expect(gateway).toContain('controller: z.literal("openclaw")');
  });

  it("validates agent result evidence before PerformanceInsight persistence", () => {
    const actions = read("app/(dashboard)/performance/actions.ts");
    expect(actions).toContain("syncLatestMarketingIntelligence");
    expect(actions).toContain("MarketingIntelligenceResultSchema");
    expect(actions).toContain("validateMarketingIntelligenceEvidenceRefs");
    expect(actions).toContain("agentRunId: run.id");
  });

  it("feeds persisted agent insight into existing Review/Revision", () => {
    const review = read("app/(dashboard)/review/actions.ts");
    expect(review).toContain("db.performanceInsight.findMany");
    expect(review).toContain("runModule(revisionModule, input)");
    expect(review).toContain("applyRevision");
  });

  it("does not describe Termius or 9router as AI providers", () => {
    const actions = read("app/(dashboard)/performance/actions.ts");
    expect(actions).toContain(
      "Termius/9router chỉ là lớp hỗ trợ cho OpenClaw, không phải AI provider.",
    );
  });
});
