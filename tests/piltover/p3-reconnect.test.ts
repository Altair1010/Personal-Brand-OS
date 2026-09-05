import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaJobQueue } from "@/lib/piltover/modules/agents/infrastructure/prisma-job-queue";
import { PrismaRunEvents } from "@/lib/piltover/modules/agents/infrastructure/prisma-run-events";
import { PrismaWorkerReconnect } from "@/lib/piltover/modules/agents/infrastructure/prisma-worker-reconnect";
import { PrismaWorkerRegistry } from "@/lib/piltover/modules/workers/infrastructure/prisma-worker-registry";
import type { P3Fixture } from "./p3-test-db";
import { createP3Fixture } from "./p3-test-db";

class MutableClock { constructor(public value: Date) {} now(): Date { return new Date(this.value); } }

const runRequest = {
  schemaVersion: "1.0" as const, runId: "run-a", organizationId: "org-a",
  workspaceId: "workspace-a", brandId: null, roleRef: "role:writer@1",
  task: { type: "WRITE", instruction: "Draft safely" },
  contextRef: { id: "context-a", hash: "hash-a" }, permissionManifestRef: "permission:1",
  requiredCapabilities: ["git"], idempotencyKey: "run-a", priority: 50,
};

describe("P3 transport-independent Worker reconnect", () => {
  let fixture: P3Fixture;
  let clock: MutableClock;
  let queue: PrismaJobQueue;
  let registry: PrismaWorkerRegistry;
  let events: PrismaRunEvents;
  let reconnect: PrismaWorkerReconnect;

  beforeEach(async () => {
    fixture = await createP3Fixture();
    clock = new MutableClock(new Date("2026-09-06T00:00:00.000Z"));
    queue = new PrismaJobQueue(fixture.db, clock);
    registry = new PrismaWorkerRegistry(fixture.db, clock);
    events = new PrismaRunEvents(fixture.db, clock);
    reconnect = new PrismaWorkerReconnect(fixture.db, clock);
    for (const workerId of ["worker-a", "worker-b"]) {
      await registry.register({
        schemaVersion: "1.0", workerId, deviceName: workerId, capabilities: ["git"],
        runtime: { adapter: "future-runtime", version: "1.0.0", protocolVersion: "1.0" },
      });
      await registry.grantWorkspace(fixture.ownerActor, workerId, "workspace-a", `grant-${workerId}`);
    }
    await queue.createRun(runRequest, "run-correlation");
    await queue.enqueue({ id: "job-a", runId: "run-a", idempotencyKey: "job-a", maxAttempts: 2 });
  }, 20_000);

  afterEach(async () => { await fixture.database.dispose(); });

  it("returns the current authoritative lease and strictly ordered event delta", async () => {
    const claim = await queue.claimEligible("worker-a", 1_000);
    await events.append({
      schemaVersion: "1.0", runId: "run-a", sequence: 0, eventType: "QUEUED",
      timestamp: clock.now().toISOString(), correlationId: "run-correlation",
    }, { type: "SYSTEM", actorId: "control-plane" });
    await events.append({
      schemaVersion: "1.0", runId: "run-a", sequence: 1, eventType: "CLAIMED",
      timestamp: clock.now().toISOString(), correlationId: "run-correlation",
    }, { type: "SYSTEM", actorId: "control-plane" });

    const response = await reconnect.reconnect({
      workerId: "worker-a", capabilityVersion: 1,
      leases: [{ jobId: "job-a", leaseId: claim!.lease.id }],
      acknowledgements: [{ runId: "run-a", sequence: 0 }],
    });
    expect(response.leases).toEqual([{ jobId: "job-a", leaseId: claim!.lease.id, status: "CURRENT" }]);
    expect(response.eventDeltas[0].events.map(({ sequence }) => sequence)).toEqual([1]);
  });

  it("reports expiry and later reclaim without reviving the old lease", async () => {
    const first = await queue.claimEligible("worker-a", 1_000);
    clock.value = new Date("2026-09-06T00:00:02.000Z");
    expect((await reconnect.reconnect({
      workerId: "worker-a", capabilityVersion: 1,
      leases: [{ jobId: "job-a", leaseId: first!.lease.id }], acknowledgements: [],
    })).leases[0].status).toBe("EXPIRED");
    await queue.reconcileExpiredLeases(0);
    const second = await queue.claimEligible("worker-b", 1_000);
    const response = await reconnect.reconnect({
      workerId: "worker-a", capabilityVersion: 1,
      leases: [{ jobId: "job-a", leaseId: first!.lease.id }], acknowledgements: [],
    });
    expect(second!.lease.id).not.toBe(first!.lease.id);
    expect(response.leases[0].status).toBe("RECLAIMED");
  });

  it("removes reconnect authority after grant revocation or Worker disable", async () => {
    const first = await queue.claimEligible("worker-a", 10_000);
    await registry.revokeWorkspace(fixture.ownerActor, "worker-a", "workspace-a", "revoke-a");
    expect((await reconnect.reconnect({
      workerId: "worker-a", capabilityVersion: 1,
      leases: [{ jobId: "job-a", leaseId: first!.lease.id }], acknowledgements: [],
    })).leases[0].status).toBe("UNAUTHORIZED");

    await registry.grantWorkspace(fixture.ownerActor, "worker-a", "workspace-a", "regrant-a");
    await registry.disable("worker-a", "platform-owner", "disable-a");
    const disabled = await reconnect.reconnect({
      workerId: "worker-a", capabilityVersion: 1,
      leases: [{ jobId: "job-a", leaseId: first!.lease.id }], acknowledgements: [],
    });
    expect(disabled.workerStatus).toBe("DISABLED");
    expect(disabled.leases[0].status).toBe("DISABLED");
    expect(disabled.eventDeltas).toEqual([]);
  });

  it("reports cancellation while offline and rejects impossible acknowledgements", async () => {
    const claim = await queue.claimEligible("worker-a", 10_000);
    await queue.cancelRun(fixture.ownerActor, "run-a", "cancel-a");
    expect((await reconnect.reconnect({
      workerId: "worker-a", capabilityVersion: 1,
      leases: [{ jobId: "job-a", leaseId: claim!.lease.id }], acknowledgements: [],
    })).leases[0].status).toBe("CANCELLED");
    await expect(reconnect.reconnect({
      workerId: "worker-a", capabilityVersion: 1, leases: [],
      acknowledgements: [{ runId: "run-a", sequence: 9 }],
    })).rejects.toThrow("AGENT_EVENT_SEQUENCE_INVALID");
  });
});
