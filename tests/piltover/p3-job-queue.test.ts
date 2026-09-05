import { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaJobQueue } from "@/lib/piltover/modules/agents/infrastructure/prisma-job-queue";
import { PrismaWorkerRegistry } from "@/lib/piltover/modules/workers/infrastructure/prisma-worker-registry";
import type { P3Fixture } from "./p3-test-db";
import { createP3Fixture } from "./p3-test-db";

class MutableClock {
  constructor(private value: Date) {}
  now(): Date { return new Date(this.value); }
  advance(milliseconds: number): void { this.value = new Date(this.value.getTime() + milliseconds); }
}

const request = {
  schemaVersion: "1.0" as const,
  runId: "run-a",
  organizationId: "org-a",
  workspaceId: "workspace-a",
  brandId: null,
  roleRef: "role:writer@1",
  task: { type: "WRITE", instruction: "Draft safely" },
  contextRef: { id: "context-a", hash: "context-hash" },
  permissionManifestRef: "permission:1",
  requiredCapabilities: ["git"],
  idempotencyKey: "request-a",
  priority: 70,
};

const registration = (workerId: string) => ({
  schemaVersion: "1.0" as const,
  workerId,
  deviceName: workerId,
  capabilities: ["git"],
  runtime: { adapter: "future-runtime", version: "1.0.0", protocolVersion: "1.0" },
});

describe("P3 durable Job queue and lease fencing", () => {
  let fixture: P3Fixture;
  let clock: MutableClock;
  let queue: PrismaJobQueue;
  let registry: PrismaWorkerRegistry;

  beforeEach(async () => {
    fixture = await createP3Fixture();
    clock = new MutableClock(new Date("2026-09-06T00:00:00.000Z"));
    queue = new PrismaJobQueue(fixture.db, clock);
    registry = new PrismaWorkerRegistry(fixture.db, clock);
    await registry.register(registration("worker-a"));
    await registry.register(registration("worker-b"));
  }, 20_000);

  afterEach(async () => {
    await fixture.database.dispose();
  });

  it("deduplicates the same scoped RunRequest and rejects changed material", async () => {
    const first = await queue.createRun(request, "correlation-a");
    const duplicate = await queue.createRun(request, "correlation-a");
    expect(duplicate.id).toBe(first.id);
    await expect(
      queue.createRun({ ...request, task: { ...request.task, instruction: "Changed" } }, "correlation-a"),
    ).rejects.toThrow("AGENT_IDEMPOTENCY_CONFLICT");
    expect(await fixture.db.agentRun.count()).toBe(1);
  });

  it("enforces tenant authorization when reading a Run", async () => {
    await queue.createRun(request, "correlation-a");
    await expect(queue.getRun(fixture.foreignActor, "run-a")).rejects.toThrow("PERMISSION_DENIED");
    await expect(queue.getRun(fixture.ownerActor, "run-a")).resolves.toMatchObject({ id: "run-a" });
  });

  it("rejects missing or widened Worker execution scope before Job creation", async () => {
    await queue.createRun({ ...request, workspaceId: null, idempotencyKey: "org-run" }, "correlation-org");
    await expect(
      queue.enqueue({ runId: "run-a", id: "job-a", idempotencyKey: "job-a", maxAttempts: 2 }),
    ).rejects.toThrow("WORKER_SCOPE_REQUIRED");

    await queue.createRun({ ...request, runId: "run-brand", brandId: "brand-a1", idempotencyKey: "brand-run" }, "correlation-brand");
    await expect(
      queue.enqueue({
        runId: "run-brand", id: "job-brand", idempotencyKey: "job-brand",
        workspaceId: "workspace-a", brandId: null, maxAttempts: 2,
      }),
    ).rejects.toThrow("TENANT_SCOPE_NOT_CONTAINED");
    expect(await fixture.db.job.count()).toBe(0);
  });

  it("requires capability and exact grant, then fences grant revocation", async () => {
    await queue.createRun(request, "correlation-a");
    await queue.enqueue({
      runId: "run-a", id: "job-a", idempotencyKey: "job-a", workspaceId: "workspace-a",
      requiredCapabilities: ["git"], maxAttempts: 2,
    });
    expect(await queue.claimEligible("worker-a", 10_000)).toBeNull();

    await registry.grantWorkspace(fixture.ownerActor, "worker-a", "workspace-a", "grant-a");
    const claim = await queue.claimEligible("worker-a", 10_000);
    expect(claim?.lease.attemptNumber).toBe(1);
    await queue.markRunning("job-a", "worker-a", claim!.lease.id);

    await registry.revokeWorkspace(fixture.ownerActor, "worker-a", "workspace-a", "revoke-a");
    await expect(queue.renewLease("job-a", "worker-a", claim!.lease.id, 10_000)).rejects.toThrow(
      "WORKER_TENANT_GRANT_REQUIRED",
    );
    await expect(
      queue.complete("job-a", "worker-a", claim!.lease.id, {
        schemaVersion: "1.0", runId: "run-a", status: "COMPLETED",
        completedAt: clock.now().toISOString(), summary: "stale",
      }),
    ).rejects.toThrow("WORKER_TENANT_GRANT_REQUIRED");
    expect((await fixture.db.job.findUniqueOrThrow({ where: { id: "job-a" } })).status).toBe("RUNNING");
  });

  it("allows exactly one claimant and rejects stale completion after reclaim", async () => {
    await queue.createRun(request, "correlation-a");
    await queue.enqueue({
      runId: "run-a", id: "job-a", idempotencyKey: "job-a", workspaceId: "workspace-a",
      requiredCapabilities: ["git"], maxAttempts: 2,
    });
    await registry.grantWorkspace(fixture.ownerActor, "worker-a", "workspace-a", "grant-a");
    await registry.grantWorkspace(fixture.ownerActor, "worker-b", "workspace-a", "grant-b");

    const secondClient = new PrismaClient({ datasources: { db: { url: fixture.database.url } } });
    const secondQueue = new PrismaJobQueue(secondClient, clock);
    try {
      const claims = await Promise.all([
        queue.claimEligible("worker-a", 1_000),
        secondQueue.claimEligible("worker-b", 1_000),
      ]);
      expect(claims.filter(Boolean)).toHaveLength(1);
      expect(await fixture.db.workerLease.count()).toBe(1);

      const first = claims.find(Boolean)!;
      const firstWorker = first.lease.workerId;
      const reclaimWorker = firstWorker === "worker-a" ? "worker-b" : "worker-a";
      clock.advance(1_001);
      await queue.reconcileExpiredLeases(500);
      clock.advance(500);
      const reclaimed = await queue.claimEligible(reclaimWorker, 10_000);
      expect(reclaimed?.lease.id).not.toBe(first.lease.id);
      expect(reclaimed?.lease.attemptNumber).toBe(2);
      await queue.markRunning("job-a", reclaimWorker, reclaimed!.lease.id);

      const staleResult = {
        schemaVersion: "1.0" as const, runId: "run-a", status: "COMPLETED" as const,
        completedAt: clock.now().toISOString(), summary: "stale result",
      };
      await expect(
        queue.complete("job-a", firstWorker, first.lease.id, staleResult),
      ).rejects.toThrow("WORKER_STALE_LEASE");

      const acceptedResult = { ...staleResult, summary: "authoritative result" };
      await queue.complete("job-a", reclaimWorker, reclaimed!.lease.id, acceptedResult);
      clock.advance(20_000);
      await queue.complete("job-a", reclaimWorker, reclaimed!.lease.id, acceptedResult);
      await expect(
        queue.complete("job-a", reclaimWorker, reclaimed!.lease.id, { ...acceptedResult, summary: "conflict" }),
      ).rejects.toThrow("AGENT_TERMINAL_RESULT_CONFLICT");
      expect((await fixture.db.agentRun.findUniqueOrThrow({ where: { id: "run-a" } })).status).toBe("COMPLETED");
    } finally {
      await secondClient.$disconnect();
    }
  }, 20_000);

  it("respects nextAttemptAt and fails durably at max attempts", async () => {
    await queue.createRun(request, "correlation-a");
    await queue.enqueue({
      runId: "run-a", id: "job-a", idempotencyKey: "job-a", workspaceId: "workspace-a",
      requiredCapabilities: ["git"], maxAttempts: 1,
    });
    await registry.grantWorkspace(fixture.ownerActor, "worker-a", "workspace-a", "grant-a");
    const claim = await queue.claimEligible("worker-a", 1_000);
    clock.advance(1_001);
    await queue.reconcileExpiredLeases(5_000);
    expect(await queue.claimEligible("worker-a", 1_000)).toBeNull();
    const job = await fixture.db.job.findUniqueOrThrow({ where: { id: "job-a" } });
    const run = await fixture.db.agentRun.findUniqueOrThrow({ where: { id: "run-a" } });
    expect(claim?.lease.attemptNumber).toBe(1);
    expect(job.status).toBe("FAILED");
    expect(run.status).toBe("FAILED");
  });

  it("keeps a retry unavailable until nextAttemptAt and then grants a new attempt", async () => {
    await queue.createRun(request, "correlation-a");
    await queue.enqueue({
      runId: "run-a", id: "job-a", idempotencyKey: "job-a", workspaceId: "workspace-a",
      requiredCapabilities: ["git"], maxAttempts: 2,
    });
    await registry.grantWorkspace(fixture.ownerActor, "worker-a", "workspace-a", "grant-a");
    await queue.claimEligible("worker-a", 1_000);
    clock.advance(1_001);
    await queue.reconcileExpiredLeases(5_000);
    expect(await queue.claimEligible("worker-a", 1_000)).toBeNull();
    clock.advance(5_000);
    expect((await queue.claimEligible("worker-a", 1_000))?.lease.attemptNumber).toBe(2);
  });

  it("enforces the exact Workspace/Brand grant matrix during claim", async () => {
    await queue.createRun({ ...request, brandId: "brand-a1" }, "correlation-brand");
    await queue.enqueue({
      runId: "run-a", id: "job-a", idempotencyKey: "job-a", brandId: "brand-a1", maxAttempts: 2,
    });
    await registry.grantWorkspace(fixture.ownerActor, "worker-a", "workspace-a", "workspace-grant");
    expect(await queue.claimEligible("worker-a", 1_000)).toBeNull();
    await registry.grantBrand(fixture.ownerActor, "worker-a", "brand-a2", "sibling-brand-grant");
    expect(await queue.claimEligible("worker-a", 1_000)).toBeNull();
    await registry.grantBrand(fixture.ownerActor, "worker-a", "brand-a1", "exact-brand-grant");
    expect((await queue.claimEligible("worker-a", 1_000))?.job.id).toBe("job-a");
  });

  it("keeps a valid Job durable while no eligible Worker is available", async () => {
    await queue.createRun(request, "correlation-a");
    await queue.enqueue({ runId: "run-a", id: "job-a", idempotencyKey: "job-a", maxAttempts: 2 });
    expect(await queue.claimEligible("worker-a", 1_000)).toBeNull();
    expect((await fixture.db.job.findUniqueOrThrow({ where: { id: "job-a" } })).status).toBe("QUEUED");
    await registry.grantWorkspace(fixture.ownerActor, "worker-a", "workspace-a", "grant-a");
    expect((await queue.claimEligible("worker-a", 1_000))?.job.id).toBe("job-a");
  });

  it("claims by priority, age, and stable ID rather than database order", async () => {
    await registry.grantWorkspace(fixture.ownerActor, "worker-a", "workspace-a", "grant-a");
    for (const [runId, jobId] of [["run-z", "job-z"], ["run-a", "job-a"]] as const) {
      await queue.createRun({ ...request, runId, idempotencyKey: runId }, `correlation-${runId}`);
      await queue.enqueue({ runId, id: jobId, idempotencyKey: jobId, maxAttempts: 2, priority: 80 });
    }
    const sameCreatedAt = new Date("2026-09-06T00:00:00.000Z");
    await fixture.db.job.updateMany({ data: { createdAt: sameCreatedAt } });
    expect((await queue.claimEligible("worker-a", 1_000))?.job.id).toBe("job-a");
  });

  it("fences a disabled Worker while preserving its running Job", async () => {
    await queue.createRun(request, "correlation-a");
    await queue.enqueue({
      runId: "run-a", id: "job-a", idempotencyKey: "job-a", workspaceId: "workspace-a",
      requiredCapabilities: ["git"], maxAttempts: 2,
    });
    await registry.grantWorkspace(fixture.ownerActor, "worker-a", "workspace-a", "grant-a");
    const claim = await queue.claimEligible("worker-a", 10_000);
    await queue.markRunning("job-a", "worker-a", claim!.lease.id);
    await registry.disable("worker-a", "platform-owner", "disable-a");
    await expect(queue.renewLease("job-a", "worker-a", claim!.lease.id, 10_000)).rejects.toThrow(
      "WORKER_DISABLED",
    );
    await expect(queue.complete("job-a", "worker-a", claim!.lease.id, {
      schemaVersion: "1.0", runId: "run-a", status: "COMPLETED",
      completedAt: clock.now().toISOString(), summary: "disabled result",
    })).rejects.toThrow("WORKER_DISABLED");
    expect((await fixture.db.job.findUniqueOrThrow({ where: { id: "job-a" } })).status).toBe("RUNNING");
  });

  it("serializes grant revocation and result submission without a stale overwrite", async () => {
    await queue.createRun(request, "correlation-a");
    await queue.enqueue({ runId: "run-a", id: "job-a", idempotencyKey: "job-a", maxAttempts: 2 });
    await registry.grantWorkspace(fixture.ownerActor, "worker-a", "workspace-a", "grant-a");
    const claim = await queue.claimEligible("worker-a", 10_000);
    await queue.markRunning("job-a", "worker-a", claim!.lease.id);
    const secondClient = new PrismaClient({ datasources: { db: { url: fixture.database.url } } });
    const secondRegistry = new PrismaWorkerRegistry(secondClient, clock);
    const result = {
      schemaVersion: "1.0" as const, runId: "run-a", status: "COMPLETED" as const,
      completedAt: clock.now().toISOString(), summary: "race result",
    };
    try {
      const outcomes = await Promise.allSettled([
        queue.complete("job-a", "worker-a", claim!.lease.id, result),
        secondRegistry.revokeWorkspace(fixture.ownerActor, "worker-a", "workspace-a", "revoke-race"),
      ]);
      expect(outcomes[1].status).toBe("fulfilled");
      expect((await fixture.db.workerWorkspaceGrant.findUniqueOrThrow({
        where: { workerId_workspaceId: { workerId: "worker-a", workspaceId: "workspace-a" } },
      })).status).toBe("REVOKED");
      const terminal = (await fixture.db.agentRun.findUniqueOrThrow({ where: { id: "run-a" } })).status;
      expect(["RUNNING", "COMPLETED"]).toContain(terminal);
      if (outcomes[0].status === "rejected") expect(terminal).toBe("RUNNING");
    } finally {
      await secondClient.$disconnect();
    }
  });
});
