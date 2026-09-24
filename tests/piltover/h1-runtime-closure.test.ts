import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");
const read = (relative: string) =>
  fs.readFileSync(path.join(root, relative), "utf8");

describe("H1.4 runtime closure contract", () => {
  it("defines the full H1 golden journey across navigation and the operational home", () => {
    const sidebar = read("components/layout/Sidebar.tsx");
    const page = read("app/(dashboard)/page.tsx");
    for (const route of [
      "/onboarding",
      "/strategy",
      "/studio",
      "/campaigns",
      "/performance",
      "/review",
    ]) {
      expect(sidebar).toContain(`href: "${route}"`);
    }
    for (const section of ["Command Center", "Pending approvals", "Campaign pulse", "Recent intelligence"]) {
      expect(page).toContain(section);
    }
  });

  it("uses Agent Control Plane for every AI capability in the canonical H1 demo", () => {
    for (const file of [
      "app/(dashboard)/strategy/actions.ts",
      "app/(dashboard)/performance/actions.ts",
      "app/(dashboard)/review/actions.ts",
    ]) {
      const source = read(file);
      expect(source).toContain("AgentExecutionGateway");
      expect(source).not.toContain("runModule(");
      expect(source).not.toContain("resolveModelConfig");
      expect(source).not.toContain("ANTHROPIC_API_KEY");
      expect(source).not.toContain("OPENAI_API_KEY");
    }
  });

  it("keeps agent output as proposal/evidence until Piltover validates or a human applies it", () => {
    const performance = read("app/(dashboard)/performance/actions.ts");
    const review = read("app/(dashboard)/review/actions.ts");
    expect(performance).toContain("validateMarketingIntelligenceEvidenceRefs");
    expect(review).toContain("syncRevisionAgentResult");
    expect(review).toContain("applyRevisionAction");
  });

  it("records the Agent boundary audit and excludes legacy PBOS helpers from H1 acceptance", () => {
    const audit = read("docs/h1-agent-boundary-audit.md");
    expect(audit).toContain("EXCLUDED_LEGACY");
    expect(audit).toContain("canonical H1 demo");
    expect(audit).toContain("AgentExecutionGateway -> Agent Control Plane -> OAuth/OpenClaw");
  });
});
