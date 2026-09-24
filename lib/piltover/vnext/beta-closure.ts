export type EvidenceLevel = "E0" | "E1" | "E2" | "E3";
export type GateState = "PASS" | "BLOCKED" | "FAIL";

export const H2_BETA_GATES = [
  "two_real_social_provider_connections",
  "real_scheduled_publishing",
  "idempotent_retry",
  "provider_result_persistence",
  "live_metric_ingestion",
  "search_data_ingestion",
  "lineage_evidence_continuity",
  "multi_brand_account_isolation",
  "approval_audit_continuity",
  "backup_clean_restore",
  "operator_recovery_common_failures",
  "bounded_beta_soak",
  "beta_golden_journey",
] as const;

export type H2BetaGateId = typeof H2_BETA_GATES[number];

export interface BetaGateEvidence {
  gate: H2BetaGateId;
  state: GateState;
  evidenceLevel: EvidenceLevel;
  requiredLevel: EvidenceLevel;
  evidence: string[];
  blocker?: string;
}

const rank: Record<EvidenceLevel, number> = { E0: 0, E1: 1, E2: 2, E3: 3 };

export function evaluateH2BetaPromotion(gates: BetaGateEvidence[]) {
  const byId = new Map(gates.map((gate) => [gate.gate, gate]));
  const results = H2_BETA_GATES.map((id) => {
    const gate = byId.get(id);
    if (!gate) return { gate: id, promotable: false, reason: "MISSING_GATE_EVIDENCE" };
    const enoughEvidence = rank[gate.evidenceLevel] >= rank[gate.requiredLevel];
    return {
      gate: id,
      promotable: gate.state === "PASS" && enoughEvidence,
      reason: gate.state !== "PASS" ? gate.blocker || gate.state : enoughEvidence ? "PASS" : `REQUIRES_${gate.requiredLevel}`,
    };
  });
  const promotable = results.every((item) => item.promotable);
  return {
    promotable,
    productStage: promotable ? "BETA" : "DEMO",
    releaseChannel: promotable ? "beta" : "development",
    allowedClaim: promotable ? "connected usable beta" : "demonstrable product with beta closure pending",
    results,
  };
}

export function currentH2Evidence(): BetaGateEvidence[] {
  return [
    { gate: "two_real_social_provider_connections", state: "BLOCKED", evidenceLevel: "E2", requiredLevel: "E3", evidence: ["H2.1 common adapter contract and persistence"], blocker: "Real Meta + LinkedIn OAuth/account proof pending" },
    { gate: "real_scheduled_publishing", state: "BLOCKED", evidenceLevel: "E2", requiredLevel: "E3", evidence: ["H2.2 durable scheduler/worker"], blocker: "Real scheduled provider delivery with browser closed pending" },
    { gate: "idempotent_retry", state: "PASS", evidenceLevel: "E2", requiredLevel: "E2", evidence: ["H2.2 retry/reconciliation deterministic tests"] },
    { gate: "provider_result_persistence", state: "PASS", evidenceLevel: "E2", requiredLevel: "E2", evidence: ["H2.2 PublishingAttempt + provider result persistence tests"] },
    { gate: "live_metric_ingestion", state: "BLOCKED", evidenceLevel: "E2", requiredLevel: "E3", evidence: ["H2.3 canonical metric ingestion"], blocker: "Real provider metric observation pending" },
    { gate: "search_data_ingestion", state: "BLOCKED", evidenceLevel: "E2", requiredLevel: "E3", evidence: ["H2.3 Search Console adapter and canonical persistence"], blocker: "Real Search Console property sync pending" },
    { gate: "lineage_evidence_continuity", state: "PASS", evidenceLevel: "E2", requiredLevel: "E2", evidence: ["H2.3 explicit publishing/content/campaign lineage and evidence refs"] },
    { gate: "multi_brand_account_isolation", state: "BLOCKED", evidenceLevel: "E2", requiredLevel: "E3", evidence: ["H2.4 two-brand fixture isolation"], blocker: "Two real provider accounts/brands pending" },
    { gate: "approval_audit_continuity", state: "PASS", evidenceLevel: "E2", requiredLevel: "E2", evidence: ["H2.2 approval payload binding", "H2.4 action history aggregation"] },
    { gate: "backup_clean_restore", state: "BLOCKED", evidenceLevel: "E2", requiredLevel: "E3", evidence: ["H2.4 safe beta recovery envelope"], blocker: "Clean-directory restore + restart observation pending" },
    { gate: "operator_recovery_common_failures", state: "BLOCKED", evidenceLevel: "E2", requiredLevel: "E3", evidence: ["H2.2 retry/reconciliation", "H2.4 governance operational state"], blocker: "End-to-end operator walkthrough without DB repair pending" },
    { gate: "bounded_beta_soak", state: "BLOCKED", evidenceLevel: "E2", requiredLevel: "E3", evidence: ["Local deterministic soak may establish E2 only"], blocker: "Bounded real-provider soak pending" },
    { gate: "beta_golden_journey", state: "BLOCKED", evidenceLevel: "E2", requiredLevel: "E3", evidence: ["Individual workflow primitives verified through H1-H2.4"], blocker: "Single real project end-to-end journey + repeat after restart/reconnect pending" },
  ];
}
