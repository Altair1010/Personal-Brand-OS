import { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaRunEvents } from "@/lib/piltover/modules/agents/infrastructure/prisma-run-events";
import { PrismaJobQueue } from "@/lib/piltover/modules/agents/infrastructure/prisma-job-queue";
import { PrismaWorkerRegistry } from "@/lib/piltover/modules/workers/infrastructure/prisma-worker-registry";
import { PrismaApproval } from "@/lib/piltover/modules/approvals/infrastructure/prisma-approval";
import type { P3Fixture } from "./p3-test-db";
import { createP3Fixture } from "./p3-test-db";

class FixedClock { constructor(private readonly value: Date) {} now(): Date { return new Date(this.value); } }

const request = {
  schemaVersion: "1.0" as const, runId: "run-a", organizationId: "org-a",
  workspaceId: "workspace-a", brandId: null, roleRef: "role:writer@1",
  task: { type: "WRITE", instruction: "Draft safely" },
  contextRef: { id: "context-a", hash: "context-hash" }, permissionManifestRef: "permission:1",
  requiredCapabilities: ["git"], idempotencyKey: "request-a", priority: 50,
};

const result = {
  schemaVersion: "1.0" as const, runId: "run-a", status: "COMPLETED" as const,
  completedAt: "2026-09-06T00:01:00.000Z", summary: "done",
};

describe("P3 RunEvent append and cancellation", () => {
  let fixture: P3Fixture;
  let queue: PrismaJobQueue;
  let events: PrismaRunEvents;
  let registry: PrismaWorkerRegistry;
  const clock = new FixedClock(new Date("2026-09-06T00:00:00.000Z"));

  beforeEach(async () => {
    fixture = await createP3Fixture();
    queue = new PrismaJobQueue(fixture.db, clock);
    events = new PrismaRunEvents(fixture.db, clock);
    registry = new PrismaWorkerRegistry(fixture.db, clock);
    await queue.createRun(request, "correlation-a");
  }, 20_000);

  afterEach(async () => { await fixture.database.dispose(); });

  it("orders events, deduplicates identical delivery, and fails closed on conflicts and gaps", async () => {
    const event0 = {
      schemaVersion: "1.0" as const, runId: "run-a", sequence: 0, eventType: "RUN_QUEUED",
      timestamp: "2026-09-06T00:00:00.000Z", correlationId: "correlation-a", payload: { safe: true },
    };
    const event1 = { ...event0, sequence: 1, eventType: "RUN_WAITING_FOR_WORKER" };
    await events.append(event0, { type: "SYSTEM", actorId: "control-plane" });
    await events.append(event1, { type: "SYSTEM", actorId: "control-plane" });
    await events.append(event1, { type: "SYSTEM", actorId: "control-plane" });
    await expect(
      events.append({ ...event1, payload: { safe: false } }, { type: "SYSTEM", actorId: "control-plane" }),
    ).rejects.toThrow("AGENT_EVENT_SEQUENCE_CONFLICT");
    await expect(
      events.append({ ...event1, sequence: 3 }, { type: "SYSTEM", actorId: "control-plane" }),
    ).rejects.toThrow("AGENT_EVENT_SEQUENCE_GAP");
    expect(await fixture.db.runEvent.count()).toBe(2);
  });

  it("serializes concurrent writers of the same event sequence", async () => {
    const secondClient = new PrismaClient({ datasources: { db: { url: fixture.database.url } } });
    const secondEvents = new PrismaRunEvents(secondClient, clock);
    const base = {
      schemaVersion: "1.0" as const, runId: "run-a", sequence: 0, eventType: "PROGRESS",
      timestamp: "2026-09-06T00:00:00.000Z", correlationId: "correlation-a",
    };
    try {
      const outcomes = await Promise.allSettled([
        events.append({ ...base, payload: { writer: "a" } }, { type: "SYSTEM", actorId: "a" }),
        secondEvents.append({ ...base, payload: { writer: "b" } }, { type: "SYSTEM", actorId: "b" }),
      ]);
      expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
      expect(await fixture.db.runEvent.count({ where: { runId: "run-a", sequence: 0 } })).toBe(1);
    } finally {
      await secondClient.$disconnect();
    }
  });

  it("rejects obvious secret-bearing event payloads", async () => {
    await expect(
      events.append({
        schemaVersion: "1.0", runId: "run-a", sequence: 0, eventType: "OUTPUT",
        timestamp: "2026-09-06T00:00:00.000Z", correlationId: "correlation-a",
        payload: { nested: { bearerToken: "must-not-store" } },
      }, { type: "SYSTEM", actorId: "control-plane" }),
    ).rejects.toThrow("AGENT_EVENT_SECRET_REJECTED");
    expect(await fixture.db.runEvent.count()).toBe(0);
  });

  it("requires a current lease and current exact grant for Worker events", async () => {
    await registry.register({
      schemaVersion: "1.0", workerId: "worker-a", deviceName: "worker-a", capabilities: ["git"],
      runtime: { adapter: "future-runtime", version: "1.0.0", protocolVersion: "1.0" },
    });
    await registry.grantWorkspace(fixture.ownerActor, "worker-a", "workspace-a", "grant-a");
    await queue.enqueue({ runId: "run-a", id: "job-a", idempotencyKey: "job-a", workspaceId: "workspace-a", maxAttempts: 2 });
    const claim = await queue.claimEligible("worker-a", 10_000);
    await queue.markRunning("job-a", "worker-a", claim!.lease.id);
    await registry.revokeWorkspace(fixture.ownerActor, "worker-a", "workspace-a", "revoke-a");

    await expect(events.append({
      schemaVersion: "1.0", runId: "run-a", sequence: 0, eventType: "PROGRESS",
      timestamp: "2026-09-06T00:00:00.000Z", correlationId: "correlation-a", workerId: "worker-a",
    }, { type: "WORKER", workerId: "worker-a", leaseId: claim!.lease.id })).rejects.toThrow(
      "WORKER_TENANT_GRANT_REQUIRED",
    );
  });

  it("denies foreign event history reads", async () => {
    await events.append({
      schemaVersion: "1.0", runId: "run-a", sequence: 0, eventType: "RUN_QUEUED",
      timestamp: "2026-09-06T00:00:00.000Z", correlationId: "correlation-a",
    }, { type: "SYSTEM", actorId: "control-plane" });
    await expect(events.readAfter(fixture.foreignActor, "run-a", -1)).rejects.toThrow("PERMISSION_DENIED");
    expect((await events.readAfter(fixture.ownerActor, "run-a", -1)).map(({ sequence }) => sequence)).toEqual([0]);
  });

  it("makes cancellation durable and rejects stale completion", async () => {
    await registry.register({
      schemaVersion: "1.0", workerId: "worker-a", deviceName: "worker-a", capabilities: ["git"],
      runtime: { adapter: "future-runtime", version: "1.0.0", protocolVersion: "1.0" },
    });
    await registry.grantWorkspace(fixture.ownerActor, "worker-a", "workspace-a", "grant-a");
    await queue.enqueue({ runId: "run-a", id: "job-a", idempotencyKey: "job-a", workspaceId: "workspace-a", maxAttempts: 2 });
    const claim = await queue.claimEligible("worker-a", 10_000);
    await queue.markRunning("job-a", "worker-a", claim!.lease.id);
    await queue.cancelRun(fixture.ownerActor, "run-a", "cancel-a");
    await queue.cancelRun(fixture.ownerActor, "run-a", "cancel-a");
    await expect(queue.complete("job-a", "worker-a", claim!.lease.id, result)).rejects.toThrow("WORKER_STALE_LEASE");
    expect((await fixture.db.agentRun.findUniqueOrThrow({ where: { id: "run-a" } })).status).toBe("CANCELLED");
    expect((await fixture.db.job.findUniqueOrThrow({ where: { id: "job-a" } })).status).toBe("CANCELLED");
  });

  it("cancels queued and waiting-approval Runs without requiring a live Worker", async () => {
    await queue.enqueue({ runId: "run-a", id: "job-a", idempotencyKey: "job-a", maxAttempts: 2 });
    await queue.cancelRun(fixture.ownerActor, "run-a", "cancel-queued");
    expect((await fixture.db.job.findUniqueOrThrow({ where: { id: "job-a" } })).status).toBe("CANCELLED");

    const secondRequest = { ...request, runId: "run-b", idempotencyKey: "request-b" };
    await queue.createRun(secondRequest, "correlation-b");
    await queue.enqueue({ runId: "run-b", id: "job-b", idempotencyKey: "job-b", maxAttempts: 2 });
    await fixture.db.job.update({ where: { id: "job-b" }, data: { status: "RUNNING" } });
    await fixture.db.agentRun.update({ where: { id: "run-b" }, data: { status: "RUNNING" } });
    await new PrismaApproval(fixture.db, clock).request(fixture.ownerActor, {
      id: "approval-b", actionType: "WORK_REVIEW", targetRef: "work:b",
      target: { type: "WORKSPACE", id: "workspace-a" }, payload: { revision: 1 },
      requiredCapability: "agent.manage", expiresAt: new Date("2026-09-06T01:00:00.000Z"),
      runId: "run-b", correlationId: "approval-b",
    });
    await queue.cancelRun(fixture.ownerActor, "run-b", "cancel-waiting-approval");
    expect((await fixture.db.agentRun.findUniqueOrThrow({ where: { id: "run-b" } })).status).toBe("CANCELLED");
    expect((await fixture.db.approvalRequest.findUniqueOrThrow({ where: { id: "approval-b" } })).status).toBe("CANCELLED");
  });

  it("denies foreign cancellation", async () => {
    await queue.enqueue({ runId: "run-a", id: "job-a", idempotencyKey: "job-a", maxAttempts: 2 });
    await expect(queue.cancelRun(fixture.foreignActor, "run-a", "foreign-cancel")).rejects.toThrow("PERMISSION_DENIED");
    expect((await fixture.db.agentRun.findUniqueOrThrow({ where: { id: "run-a" } })).status).toBe("WAITING_FOR_WORKER");
  });

  it("serializes cancel and complete so exactly one terminal state wins", async () => {
    await registry.register({
      schemaVersion: "1.0", workerId: "worker-a", deviceName: "worker-a", capabilities: ["git"],
      runtime: { adapter: "future-runtime", version: "1.0.0", protocolVersion: "1.0" },
    });
    await registry.grantWorkspace(fixture.ownerActor, "worker-a", "workspace-a", "grant-a");
    await queue.enqueue({ runId: "run-a", id: "job-a", idempotencyKey: "job-a", workspaceId: "workspace-a", maxAttempts: 2 });
    const claim = await queue.claimEligible("worker-a", 10_000);
    await queue.markRunning("job-a", "worker-a", claim!.lease.id);
    const secondClient = new PrismaClient({ datasources: { db: { url: fixture.database.url } } });
    const secondQueue = new PrismaJobQueue(secondClient, clock);
    try {
      const outcomes = await Promise.allSettled([
        queue.complete("job-a", "worker-a", claim!.lease.id, result),
        secondQueue.cancelRun(fixture.ownerActor, "run-a", "cancel-race"),
      ]);
      expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
      expect(["COMPLETED", "CANCELLED"]).toContain(
        (await fixture.db.agentRun.findUniqueOrThrow({ where: { id: "run-a" } })).status,
      );
    } finally { await secondClient.$disconnect(); }
  });
});
