import { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaApproval } from "@/lib/piltover/modules/approvals/infrastructure/prisma-approval";
import { PrismaJobQueue } from "@/lib/piltover/modules/agents/infrastructure/prisma-job-queue";
import type { P3Fixture } from "./p3-test-db";
import { createP3Fixture } from "./p3-test-db";

class MutableClock {
  constructor(public value: Date) {}
  now(): Date { return new Date(this.value); }
}

const request = {
  schemaVersion: "1.0" as const, runId: "run-a", organizationId: "org-a",
  workspaceId: "workspace-a", brandId: null, roleRef: "role:writer@1",
  task: { type: "WRITE", instruction: "Draft safely" },
  contextRef: { id: "context-a", hash: "context-hash" }, permissionManifestRef: "permission:1",
  requiredCapabilities: ["git"], idempotencyKey: "request-a", priority: 50,
};

describe("P3 approval primitives", () => {
  let fixture: P3Fixture;
  let clock: MutableClock;
  let approvals: PrismaApproval;

  beforeEach(async () => {
    fixture = await createP3Fixture();
    clock = new MutableClock(new Date("2026-09-06T00:00:00.000Z"));
    approvals = new PrismaApproval(fixture.db, clock);
  }, 20_000);

  afterEach(async () => { await fixture.database.dispose(); });

  async function requestApproval(overrides: Record<string, unknown> = {}) {
    return approvals.request(fixture.ownerActor, {
      id: "approval-a", actionType: "CONTENT_PUBLISH", targetRef: "content:item-a",
      target: { type: "BRAND", id: "brand-a1" }, payload: { title: "Approved", body: "Exact" },
      requiredCapability: "content.approve", expiresAt: new Date("2026-09-06T01:00:00.000Z"),
      oneTimeNonce: "nonce-a", correlationId: "approval-correlation", ...overrides,
    });
  }

  it("binds an approval to the exact action, target, and canonical payload", async () => {
    await requestApproval();
    await expect(approvals.decide(fixture.ownerActor, "approval-a", "APPROVED", {
      body: "Exact", title: "Approved",
    })).resolves.toMatchObject({ status: "APPROVED" });
    await expect(approvals.consume(fixture.ownerActor, "approval-a", {
      title: "Changed", body: "Exact",
    }, "nonce-a")).rejects.toThrow("APPROVAL_PAYLOAD_MISMATCH");
  });

  it("expires lazily and cannot be decided or consumed afterward", async () => {
    await requestApproval({ expiresAt: new Date("2026-09-06T00:00:01.000Z") });
    clock.value = new Date("2026-09-06T00:00:02.000Z");
    await expect(approvals.decide(fixture.ownerActor, "approval-a", "APPROVED", {
      title: "Approved", body: "Exact",
    })).rejects.toThrow("APPROVAL_EXPIRED");
    expect((await fixture.db.approvalRequest.findUniqueOrThrow({ where: { id: "approval-a" } })).status).toBe("EXPIRED");
  });

  it("allows at most one concurrent one-time consumption", async () => {
    await requestApproval();
    const payload = { title: "Approved", body: "Exact" };
    await approvals.decide(fixture.ownerActor, "approval-a", "APPROVED", payload);
    const secondClient = new PrismaClient({ datasources: { db: { url: fixture.database.url } } });
    const competing = new PrismaApproval(secondClient, clock);
    const outcomes = await Promise.allSettled([
      approvals.consume(fixture.ownerActor, "approval-a", payload, "nonce-a"),
      competing.consume(fixture.ownerActor, "approval-a", payload, "nonce-a"),
    ]);
    await secondClient.$disconnect();
    expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter(({ status }) => status === "rejected")).toHaveLength(1);
    expect((await fixture.db.approvalRequest.findUniqueOrThrow({ where: { id: "approval-a" } })).consumedAt).not.toBeNull();
  });

  it("denies foreign and insufficient-RBAC decision actors", async () => {
    await requestApproval();
    await expect(approvals.decide(fixture.foreignActor, "approval-a", "APPROVED", {
      title: "Approved", body: "Exact",
    })).rejects.toThrow("PERMISSION_DENIED");

    await fixture.db.userIdentity.create({ data: { id: "identity-viewer" } });
    await fixture.db.authIdentity.create({
      data: { id: "auth-viewer", userIdentityId: "identity-viewer", provider: "test", subject: "viewer" },
    });
    await fixture.db.membership.create({
      data: { id: "membership-viewer", userIdentityId: "identity-viewer", organizationId: "org-a", organizationRole: "VIEWER" },
    });
    await expect(approvals.decide({ provider: "test", subject: "viewer" }, "approval-a", "APPROVED", {
      title: "Approved", body: "Exact",
    })).rejects.toThrow("PERMISSION_DENIED");
  });

  it("makes decisions single-terminal and cancellation final", async () => {
    await requestApproval();
    const payload = { title: "Approved", body: "Exact" };
    await approvals.decide(fixture.ownerActor, "approval-a", "REJECTED", payload);
    await expect(approvals.decide(fixture.ownerActor, "approval-a", "APPROVED", payload)).rejects.toThrow(
      "APPROVAL_DECISION_CONFLICT",
    );

    await requestApproval({ id: "approval-b", oneTimeNonce: "nonce-b" });
    await approvals.cancel(fixture.ownerActor, "approval-b");
    await approvals.cancel(fixture.ownerActor, "approval-b");
    await expect(approvals.decide(fixture.ownerActor, "approval-b", "APPROVED", payload)).rejects.toThrow(
      "APPROVAL_DECISION_CONFLICT",
    );
  });

  it("pauses a running Run and requeues it after one-time approval consumption", async () => {
    const queue = new PrismaJobQueue(fixture.db, clock);
    await queue.createRun(request, "run-correlation");
    await queue.enqueue({ id: "job-a", runId: "run-a", idempotencyKey: "job-a", maxAttempts: 2 });
    await fixture.db.job.update({ where: { id: "job-a" }, data: { status: "RUNNING" } });
    await fixture.db.agentRun.update({ where: { id: "run-a" }, data: { status: "RUNNING" } });

    await requestApproval({ runId: "run-a" });
    expect((await fixture.db.agentRun.findUniqueOrThrow({ where: { id: "run-a" } })).status).toBe("WAITING_APPROVAL");
    const payload = { title: "Approved", body: "Exact" };
    await approvals.decide(fixture.ownerActor, "approval-a", "APPROVED", payload);
    await approvals.consume(fixture.ownerActor, "approval-a", payload, "nonce-a");
    expect((await fixture.db.agentRun.findUniqueOrThrow({ where: { id: "run-a" } })).status).toBe("RETRY_PENDING");
    expect((await fixture.db.job.findUniqueOrThrow({ where: { id: "job-a" } })).status).toBe("RETRY_PENDING");
  });
});
