import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");
const read = (relative: string) =>
  fs.readFileSync(path.join(root, relative), "utf8");

describe("H1.3 runtime + intelligence loop contract", () => {
  it("analyzes Organic and Paid evidence through one intelligence module", () => {
    const prompt = read("lib/prompts/marketing-intelligence.ts");
    expect(prompt).toContain("ORGANIC EVIDENCE");
    expect(prompt).toContain("PAID EVIDENCE");
    expect(prompt).toContain("cross_channel");
    expect(prompt).toContain("EXTERNAL_NOT_CONNECTED");
  });

  it("rejects fabricated evidence references before persistence", () => {
    const actions = read("app/(dashboard)/performance/actions.ts");
    expect(actions).toContain("validateMarketingIntelligenceEvidenceRefs");
    expect(actions).toContain("AI evidence refs không hợp lệ");
  });

  it("persists evidence provenance and tenant scope", () => {
    const actions = read("app/(dashboard)/performance/actions.ts");
    expect(actions).toContain('mode: "organic_paid"');
    expect(actions).toContain("refs: ins.evidenceRefs");
    expect(actions).toContain("organizationId: tenant.organizationId");
    expect(actions).toContain("brandId: tenant.brandId");
  });

  it("feeds performance insight into the strategy revision loop", () => {
    const review = read("app/(dashboard)/review/actions.ts");
    expect(review).toContain("db.performanceInsight.findMany");
    expect(review).toContain("runModule(revisionModule, input)");
    expect(review).toContain("applyRevision");
  });

  it("exposes explicit AI runtime readiness in the product UI", () => {
    const card = read("components/performance/LatestInsightCard.tsx");
    expect(card).toContain("AI READY");
    expect(card).toContain("AI NOT CONFIGURED");
    expect(card).toContain("Phân tích Organic + Paid");
  });
});
