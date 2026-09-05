import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaControlPlaneHealth } from "@/lib/piltover/modules/platform/infrastructure/prisma-control-plane-health";
import { PrismaJobQueue } from "@/lib/piltover/modules/agents/infrastructure/prisma-job-queue";
import { PrismaWorkerRegistry } from "@/lib/piltover/modules/workers/infrastructure/prisma-worker-registry";
import type { P3Fixture } from "./p3-test-db";
import { createP3Fixture } from "./p3-test-db";

class FixedClock { constructor(private readonly value: Date) {} now(): Date { return new Date(this.value); } }

const request = {
  schemaVersion: "1.0" as const, runId: "run-a", organizationId: "org-a",
  workspaceId: "workspace-a", brandId: null, roleRef: "role:writer@1",
  task: { type: "WRITE", instruction: "Draft" }, contextRef: { id: "context-a", hash: "hash-a" },
  permissionManifestRef: "permission:1", requiredCapabilities: ["git"], idempotencyKey: "run-a",
};

describe("P3 read-only health", () => {
  let fixture: P3Fixture;

  beforeEach(async () => { fixture = await createP3Fixture(); }, 20_000);
  afterEach(async () => { await fixture.database.dispose(); });

  it("reports queue, Worker, lease, and Run facts without reconciling state", async () => {
    const clock = new FixedClock(new Date("2026-09-06T00:01:00.000Z"));
    const earlier = new FixedClock(new Date("2026-09-06T00:00:00.000Z"));
    const queue = new PrismaJobQueue(fixture.db, earlier);
    const registry = new PrismaWorkerRegistry(fixture.db, earlier);
    await registry.register({
      schemaVersion: "1.0", workerId: "worker-a", deviceName: "worker-a", capabilities: ["git"],
      runtime: { adapter: "future-runtime", version: "1", protocolVersion: "1.0" },
    });
    await registry.grantWorkspace(fixture.ownerActor, "worker-a", "workspace-a", "grant-a");
    await queue.createRun(request, "correlation-a");
    await queue.enqueue({ id: "job-a", runId: "run-a", idempotencyKey: "job-a", maxAttempts: 2 });
    await queue.claimEligible("worker-a", 1_000);

    const before = await fixture.db.job.findUniqueOrThrow({ where: { id: "job-a" } });
    const health = await new PrismaControlPlaneHealth(fixture.db, clock, 30_000).read();
    const after = await fixture.db.job.findUniqueOrThrow({ where: { id: "job-a" } });

    expect(health).toMatchObject({
      controlPlane: { status: "OK" }, database: { status: "OK" },
      workers: { registered: 1, enabled: 1, fresh: 0, stale: 1 },
      leases: { active: 0, expiredAwaitingReconciliation: 1 },
      runs: { waitingForWorker: 0, running: 0, waitingApproval: 0 },
    });
    expect(health.queue).toMatchObject({ queued: 0, retryPending: 0, eligible: 0 });
    expect(after.status).toBe(before.status);
    expect(after.currentLeaseId).toBe(before.currentLeaseId);
  });
});
