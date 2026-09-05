import { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaApproval } from "@/lib/piltover/modules/approvals/infrastructure/prisma-approval";
import { PrismaJobQueue } from "@/lib/piltover/modules/agents/infrastructure/prisma-job-queue";
import { PrismaRunEvents } from "@/lib/piltover/modules/agents/infrastructure/prisma-run-events";
import { PrismaWorkerRegistry } from "@/lib/piltover/modules/workers/infrastructure/prisma-worker-registry";
import type { P3Fixture } from "./p3-test-db";
import { createP3Fixture } from "./p3-test-db";

class MutableClock { constructor(public value: Date) {} now(): Date { return new Date(this.value); } }

describe("P3 process-restart durability", () => {
  let fixture: P3Fixture;
  beforeEach(async () => { fixture = await createP3Fixture(); }, 20_000);
  afterEach(async () => { await fixture.database.dispose(); });

  it("reconstructs Run, Job, lease, events, approval, Worker, and grant after reopening Prisma", async () => {
    const clock = new MutableClock(new Date("2026-09-06T00:00:00.000Z"));
    const queue = new PrismaJobQueue(fixture.db, clock);
    const registry = new PrismaWorkerRegistry(fixture.db, clock);
    await registry.register({
      schemaVersion: "1.0", workerId: "worker-a", deviceName: "worker-a", capabilities: ["git"],
      runtime: { adapter: "future-runtime", version: "1", protocolVersion: "1.0" },
    });
    await registry.grantWorkspace(fixture.ownerActor, "worker-a", "workspace-a", "grant-a");
    await queue.createRun({
      schemaVersion: "1.0", runId: "run-a", organizationId: "org-a", workspaceId: "workspace-a",
      roleRef: "role:writer@1", task: { type: "WRITE", instruction: "Draft" },
      contextRef: { id: "context-a", hash: "hash-a" }, permissionManifestRef: "permission:1",
      requiredCapabilities: ["git"], idempotencyKey: "run-a",
    }, "run-correlation");
    await queue.enqueue({ id: "job-a", runId: "run-a", idempotencyKey: "job-a", maxAttempts: 2 });
    const claim = await queue.claimEligible("worker-a", 1_000);
    await queue.markRunning("job-a", "worker-a", claim!.lease.id);
    await new PrismaRunEvents(fixture.db, clock).append({
      schemaVersion: "1.0", runId: "run-a", sequence: 0, eventType: "CLAIMED",
      timestamp: clock.now().toISOString(), correlationId: "run-correlation",
    }, { type: "SYSTEM", actorId: "control-plane" });
    await new PrismaApproval(fixture.db, clock).request(fixture.ownerActor, {
      id: "approval-a", actionType: "WORK_REVIEW", targetRef: "work:item-a",
      target: { type: "WORKSPACE", id: "workspace-a" }, payload: { revision: 1 },
      requiredCapability: "agent.manage", expiresAt: new Date("2026-09-06T01:00:00.000Z"),
      correlationId: "approval-correlation",
    });
    await fixture.db.$disconnect();

    const reopened = new PrismaClient({ datasources: { db: { url: fixture.database.url } } });
    try {
      expect(await reopened.agentRun.count({ where: { id: "run-a" } })).toBe(1);
      expect(await reopened.job.count({ where: { id: "job-a" } })).toBe(1);
      expect(await reopened.workerLease.count({ where: { id: claim!.lease.id } })).toBe(1);
      expect(await reopened.runEvent.count({ where: { runId: "run-a" } })).toBe(1);
      expect(await reopened.approvalRequest.count({ where: { id: "approval-a", status: "PENDING" } })).toBe(1);
      expect(await reopened.workerWorkspaceGrant.count({ where: { workerId: "worker-a", status: "ACTIVE" } })).toBe(1);
      clock.value = new Date("2026-09-06T00:00:02.000Z");
      expect(await new PrismaJobQueue(reopened, clock).reconcileExpiredLeases(0)).toBe(1);
      expect((await reopened.job.findUniqueOrThrow({ where: { id: "job-a" } })).status).toBe("RETRY_PENDING");
    } finally {
      await reopened.$disconnect();
    }
  });
});
