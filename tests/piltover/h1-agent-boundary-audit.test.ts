import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");
const read = (relative: string) =>
  fs.readFileSync(path.join(root, relative), "utf8");

describe("H1 Agent boundary audit", () => {
  it("keeps canonical Strategy execution behind AgentExecutionGateway", () => {
    const actions = read("app/(dashboard)/strategy/actions.ts");
    expect(actions).toContain("AgentExecutionGateway");
    expect(actions).toContain('taskType: "STRATEGY_PLAN_30D"');
    expect(actions).toContain("syncStrategyAgentResult");
    expect(actions).not.toContain("runModule(");
    expect(actions).not.toContain("resolveModelConfig");
  });

  it("keeps canonical Performance intelligence behind AgentExecutionGateway", () => {
    const actions = read("app/(dashboard)/performance/actions.ts");
    expect(actions).toContain("AgentExecutionGateway");
    expect(actions).toContain('taskType: "MARKETING_INTELLIGENCE"');
    expect(actions).toContain("syncLatestMarketingIntelligence");
    expect(actions).not.toContain("runModule(");
    expect(actions).not.toContain("resolveModelConfig");
  });

  it("keeps canonical Revision execution behind AgentExecutionGateway", () => {
    const actions = read("app/(dashboard)/review/actions.ts");
    expect(actions).toContain("AgentExecutionGateway");
    expect(actions).toContain('taskType: "STRATEGY_REVISION"');
    expect(actions).toContain("syncRevisionAgentResult");
    expect(actions).not.toContain("runModule(");
    expect(actions).not.toContain("resolveModelConfig");
  });

  it("pins canonical H1 runs to Agent/Prompt/Skill registry versions", () => {
    const strategy = read("app/(dashboard)/strategy/actions.ts");
    const performance = read("app/(dashboard)/performance/actions.ts");
    const review = read("app/(dashboard)/review/actions.ts");
    expect(strategy).toContain('resolveCanonicalAgentBinding(db, "strategy-planner")');
    expect(performance).toContain('resolveCanonicalAgentBinding(db, "marketing-intelligence")');
    expect(review).toContain('resolveCanonicalAgentBinding(db, "strategy-revision")');
    for (const source of [strategy, performance, review]) {
      expect(source).toContain("...agentBinding");
      expect(source).toContain("bindingHash");
    }
  });

  it("does not route canonical H1 Agent UIs through legacy /api/ai endpoints", () => {
    const files = [
      "components/strategy/StrategyWizard.tsx",
      "components/performance/LatestInsightCard.tsx",
      "components/review/ReviewPanel.tsx",
    ];
    for (const file of files) {
      expect(read(file)).not.toContain("/api/ai/");
    }
  });

  it("documents legacy direct-model helpers as excluded from H1 canonical demo", () => {
    const audit = read("docs/h1-agent-boundary-audit.md");
    expect(audit).toContain("EXCLUDED_LEGACY");
    expect(audit).toContain("Optional legacy AI helper buttons are outside the H1 acceptance path");
  });
});
