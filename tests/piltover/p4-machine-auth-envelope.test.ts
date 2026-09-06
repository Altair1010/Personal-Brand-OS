import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaJobQueue } from "@/lib/piltover/modules/agents/infrastructure/prisma-job-queue";
import { PrismaExecutionEnvelope } from "@/lib/piltover/modules/agents/infrastructure/prisma-execution-envelope";
import { PrismaWorkerCredentialStore } from "@/lib/piltover/modules/workers/infrastructure/prisma-worker-credentials";
import { PrismaWorkerRegistry } from "@/lib/piltover/modules/workers/infrastructure/prisma-worker-registry";
import type { P3Fixture } from "./p3-test-db";
import { createP3Fixture } from "./p3-test-db";

class MutableClock {
  constructor(private value: Date) {}
  now(): Date { return new Date(this.value); }
  advance(milliseconds: number): void { this.value = new Date(this.value.getTime() + milliseconds); }
}

const registration = {
  schemaVersion: "1.0" as const,
  workerId: "worker-a",
  deviceName: "Owner workstation",
  capabilities: ["git"],
  runtime: { adapter: "codex-app-server", version: "0.153.4", protocolVersion: "1.0" },
};

const runRequest = {
  schemaVersion: "1.0" as const,
  runId: "run-a",
  organizationId: "org-a",
  workspaceId: "workspace-a",
  brandId: null,
  roleRef: "role:writer@1",
  task: { type: "WRITE", instruction: "Create a harmless note", repositoryAlias: "fixture" },
  contextRef: { id: "context-a", hash: "context-hash" },
  permissionManifestRef: "permission:1",
  requiredCapabilities: ["git"],
  idempotencyKey: "run-request-a",
};

describe("P4 Worker machine authentication and execution envelope", () => {
  let fixture: P3Fixture;
  let clock: MutableClock;
  let registry: PrismaWorkerRegistry;

  beforeEach(async () => {
    fixture = await createP3Fixture();
    clock = new MutableClock(new Date("2026-09-06T08:00:00.000Z"));
    registry = new PrismaWorkerRegistry(fixture.db, clock);
    await registry.register(registration);
    await registry.grantWorkspace(fixture.ownerActor, "worker-a", "workspace-a", "grant-a");
  }, 20_000);

  afterEach(async () => fixture.database.dispose());

  it("stores only a verifier and enforces expiry, revocation, and Worker binding", async () => {
    const credentials = new PrismaWorkerCredentialStore(fixture.db, clock);
    const issued = await credentials.issue(
      fixture.ownerActor,
      "worker-a",
      { type: "WORKSPACE", id: "workspace-a" },
      90 * 24 * 60 * 60 * 1_000,
      "issue-a",
    );

    expect(issued.credential).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    const stored = await fixture.db.workerCredential.findUniqueOrThrow({ where: { id: issued.credentialId } });
    expect(stored.secretVerifier).not.toContain(issued.credential.split(".")[1]);
    await expect(credentials.authenticate(issued.credential)).resolves.toMatchObject({ workerId: "worker-a" });

    await credentials.revoke(
      fixture.ownerActor,
      issued.credentialId,
      { type: "WORKSPACE", id: "workspace-a" },
      "revoke-a",
    );
    await expect(credentials.authenticate(issued.credential)).rejects.toThrow("AUTH_CREDENTIAL_REVOKED");
  });

  it("rotates once with a bounded overlap and never changes Worker identity", async () => {
    const credentials = new PrismaWorkerCredentialStore(fixture.db, clock);
    const issued = await credentials.issue(
      fixture.ownerActor, "worker-a", { type: "WORKSPACE", id: "workspace-a" },
      60_000, "issue-a",
    );
    const rotated = await credentials.rotate(issued.credential, 10_000, 60_000, "rotate-a");
    await expect(credentials.authenticate(issued.credential)).resolves.toMatchObject({ workerId: "worker-a" });
    await expect(credentials.authenticate(rotated.credential)).resolves.toMatchObject({ workerId: "worker-a" });
    await expect(credentials.rotate(issued.credential, 10_000, 60_000, "rotate-replay"))
      .rejects.toThrow("AUTH_CREDENTIAL_ALREADY_ROTATED");
    clock.advance(10_001);
    await expect(credentials.authenticate(issued.credential)).rejects.toThrow("AUTH_CREDENTIAL_EXPIRED");
    await expect(credentials.authenticate(rotated.credential)).resolves.toMatchObject({ workerId: "worker-a" });
  });

  it("allows authorized governance revocation after the Worker grant was revoked", async () => {
    const credentials = new PrismaWorkerCredentialStore(fixture.db, clock);
    const issued = await credentials.issue(
      fixture.ownerActor, "worker-a", { type: "WORKSPACE", id: "workspace-a" }, 60_000, "issue-a",
    );
    await registry.revokeWorkspace(fixture.ownerActor, "worker-a", "workspace-a", "grant-revoke-a");
    await credentials.revoke(
      fixture.ownerActor, issued.credentialId, { type: "WORKSPACE", id: "workspace-a" }, "credential-revoke-a",
    );
    await expect(credentials.authenticate(issued.credential)).rejects.toThrow("AUTH_CREDENTIAL_REVOKED");
    await expect(credentials.authenticate("not-a-credential")).rejects.toThrow("AUTH_INVALID_CREDENTIAL");
  });

  it("returns only a current lease-bound minimum execution envelope", async () => {
    const queue = new PrismaJobQueue(fixture.db, clock);
    await queue.createRun(runRequest, "correlation-a");
    await queue.enqueue({
      id: "job-a", runId: "run-a", idempotencyKey: "job-a", workspaceId: "workspace-a",
      requiredCapabilities: ["git"], maxAttempts: 2,
    });
    const claim = await queue.claimEligible("worker-a", 30_000);
    expect(claim).not.toBeNull();

    const envelopes = new PrismaExecutionEnvelope(fixture.db, clock);
    const envelope = await envelopes.get("worker-a", "job-a", claim!.lease.id);
    expect(envelope).toEqual(expect.objectContaining({
      schemaVersion: "1.0", runId: "run-a", jobId: "job-a", leaseId: claim!.lease.id,
      organizationId: "org-a", workspaceId: "workspace-a", brandId: null,
      repositoryAlias: "fixture", requiredCapabilities: ["git"],
    }));
    expect(envelope).not.toHaveProperty("localPath");
    await expect(envelopes.get("worker-other", "job-a", claim!.lease.id))
      .rejects.toThrow("WORKER_STALE_LEASE");

    await registry.revokeWorkspace(fixture.ownerActor, "worker-a", "workspace-a", "revoke-a");
    await expect(envelopes.get("worker-a", "job-a", claim!.lease.id))
      .rejects.toThrow("WORKER_TENANT_GRANT_REQUIRED");
  });
});
