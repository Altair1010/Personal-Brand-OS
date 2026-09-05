import { describe, expect, it } from "vitest";
import {
  assertAgentRunTransition,
  assertApprovalTransition,
  assertJobTransition,
} from "@/lib/piltover/modules/agents/domain/state-machines";

describe("P3 state machines", () => {
  it("permits the canonical AgentRun execution and approval/retry paths", () => {
    expect(() => assertAgentRunTransition("QUEUED", "WAITING_FOR_WORKER")).not.toThrow();
    expect(() => assertAgentRunTransition("WAITING_FOR_WORKER", "CLAIMED")).not.toThrow();
    expect(() => assertAgentRunTransition("CLAIMED", "RUNNING")).not.toThrow();
    expect(() => assertAgentRunTransition("RUNNING", "WAITING_APPROVAL")).not.toThrow();
    expect(() => assertAgentRunTransition("WAITING_APPROVAL", "RETRY_PENDING")).not.toThrow();
    expect(() => assertAgentRunTransition("RETRY_PENDING", "WAITING_FOR_WORKER")).not.toThrow();
    expect(() => assertAgentRunTransition("RUNNING", "COMPLETED")).not.toThrow();
  });

  it.each(["COMPLETED", "FAILED", "CANCELLED"] as const)(
    "prevents terminal AgentRun %s from returning to active state",
    (status) => {
      expect(() => assertAgentRunTransition(status, "RUNNING")).toThrow("AGENT_INVALID_TRANSITION");
    },
  );

  it("keeps Job state distinct and prevents terminal resurrection", () => {
    expect(() => assertJobTransition("QUEUED", "CLAIMED")).not.toThrow();
    expect(() => assertJobTransition("RUNNING", "RETRY_PENDING")).not.toThrow();
    expect(() => assertJobTransition("RETRY_PENDING", "QUEUED")).not.toThrow();
    expect(() => assertJobTransition("COMPLETED", "RUNNING")).toThrow("QUEUE_INVALID_TRANSITION");
  });

  it("allows Approval to leave PENDING exactly once", () => {
    expect(() => assertApprovalTransition("PENDING", "APPROVED")).not.toThrow();
    expect(() => assertApprovalTransition("PENDING", "EXPIRED")).not.toThrow();
    expect(() => assertApprovalTransition("APPROVED", "REJECTED")).toThrow(
      "APPROVAL_INVALID_TRANSITION",
    );
  });
});
