import { describe, expect, it } from "vitest";
import { currentH2Evidence, evaluateH2BetaPromotion, H2_BETA_GATES } from "../../lib/piltover/vnext/beta-closure";

describe("H2.5 beta closure gate", () => {
  it("tracks every roadmap beta promotion gate", () => {
    const evidence = currentH2Evidence();
    expect(evidence.map((item) => item.gate)).toEqual(H2_BETA_GATES);
    expect(evidence).toHaveLength(13);
  });

  it("does not promote E2 implementation evidence into E3 live proof", () => {
    const result = evaluateH2BetaPromotion(currentH2Evidence());
    expect(result.promotable).toBe(false);
    expect(result.productStage).toBe("DEMO");
    expect(result.releaseChannel).toBe("development");
    expect(result.results.find((item) => item.gate === "real_scheduled_publishing")?.promotable).toBe(false);
    expect(result.results.find((item) => item.gate === "backup_clean_restore")?.promotable).toBe(false);
  });

  it("promotes only when every gate passes at its required evidence level", () => {
    const allPass = currentH2Evidence().map((gate) => ({
      ...gate,
      state: "PASS" as const,
      evidenceLevel: gate.requiredLevel,
      blocker: undefined,
    }));
    const result = evaluateH2BetaPromotion(allPass);
    expect(result.promotable).toBe(true);
    expect(result.productStage).toBe("BETA");
    expect(result.releaseChannel).toBe("beta");
    expect(result.allowedClaim).toBe("connected usable beta");
  });

  it("fails closed when a required gate is absent", () => {
    const evidence = currentH2Evidence().filter((gate) => gate.gate !== "beta_golden_journey");
    const result = evaluateH2BetaPromotion(evidence);
    expect(result.promotable).toBe(false);
    expect(result.results.find((item) => item.gate === "beta_golden_journey")?.reason).toBe("MISSING_GATE_EVIDENCE");
  });
});
