import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaWorkerCredentialStore } from "@/lib/piltover/modules/workers/infrastructure/prisma-worker-credentials";
import { PrismaWorkerRegistry } from "@/lib/piltover/modules/workers/infrastructure/prisma-worker-registry";
import type { P3Fixture } from "./p3-test-db";
import { createP3Fixture } from "./p3-test-db";

class MutableClock {
  constructor(private value: Date) {}
  now(): Date { return new Date(this.value); }
  advance(milliseconds: number): void { this.value = new Date(this.value.getTime() + milliseconds); }
}

const DAY_MS = 24 * 60 * 60 * 1_000;
const registration = {
  schemaVersion: "1.0" as const,
  workerId: "worker-global",
  deviceName: "Owner workstation",
  capabilities: ["git"],
  runtime: { adapter: "codex-app-server", version: "0.153.4", protocolVersion: "1.0" },
};

describe("P4-G5 global machine identity governance", () => {
  let fixture: P3Fixture;
  let clock: MutableClock;
  let registry: PrismaWorkerRegistry;
  let credentials: PrismaWorkerCredentialStore;

  beforeEach(async () => {
    fixture = await createP3Fixture();
    clock = new MutableClock(new Date("2026-09-08T00:00:00.000Z"));
    registry = new PrismaWorkerRegistry(fixture.db, clock);
    credentials = new PrismaWorkerCredentialStore(fixture.db, clock);
    await registry.register(registration);
  }, 20_000);

  afterEach(async () => fixture.database.dispose());

  async function grantWorkerAcrossOrganizations(): Promise<void> {
    await registry.grantWorkspace(fixture.ownerActor, registration.workerId, "workspace-a", "grant-a");
    await registry.grantBrand(fixture.foreignActor, registration.workerId, "brand-b1", "grant-b");
  }

  async function addWholeWorkerGovernor() {
    const actor = { provider: "test", subject: "governor" } as const;
    await fixture.db.userIdentity.create({ data: { id: "identity-governor" } });
    await fixture.db.authIdentity.create({ data: {
      id: "auth-governor", userIdentityId: "identity-governor", provider: actor.provider, subject: actor.subject,
    } });
    await fixture.db.membership.createMany({ data: [
      { id: "membership-governor-a", userIdentityId: "identity-governor", organizationId: "org-a", organizationRole: "OWNER" },
      { id: "membership-governor-b", userIdentityId: "identity-governor", organizationId: "org-b", organizationRole: "OWNER" },
    ] });
    return actor;
  }

  it("denies cross-tenant issuance without returning or recording a credential", async () => {
    await grantWorkerAcrossOrganizations();

    await expect(credentials.issue(
      fixture.ownerActor, registration.workerId, { type: "WORKSPACE", id: "workspace-a" }, 90 * DAY_MS, "issue-cross-tenant",
    )).rejects.toThrow("PERMISSION_DENIED");

    expect(await fixture.db.workerCredential.count()).toBe(0);
    expect(await fixture.db.auditEntry.count({ where: { action: "WORKER_CREDENTIAL_ISSUED" } })).toBe(0);
  });

  it("allows issuance only when the actor governs every active exact grant", async () => {
    await grantWorkerAcrossOrganizations();
    const governor = await addWholeWorkerGovernor();

    const issued = await credentials.issue(
      governor, registration.workerId, { type: "WORKSPACE", id: "workspace-a" }, 90 * DAY_MS, "issue-whole-worker",
    );

    await expect(credentials.authenticate(issued.credential)).resolves.toEqual({
      workerId: registration.workerId,
      credentialId: issued.credentialId,
    });
    expect(await registry.isAuthorized(registration.workerId, { type: "BRAND", id: "brand-b1" })).toBe(true);
  });

  it("denies tenant-local global revoke while exact local grant revoke remains isolated", async () => {
    await grantWorkerAcrossOrganizations();
    const governor = await addWholeWorkerGovernor();
    const issued = await credentials.issue(
      governor, registration.workerId, { type: "BRAND", id: "brand-b1" }, DAY_MS, "issue-for-revoke",
    );

    await expect(credentials.revoke(
      fixture.ownerActor, issued.credentialId, { type: "WORKSPACE", id: "workspace-a" }, "revoke-global-denied",
    )).rejects.toThrow("PERMISSION_DENIED");
    expect((await fixture.db.workerCredential.findUniqueOrThrow({ where: { id: issued.credentialId } })).revokedAt).toBeNull();
    expect(await fixture.db.auditEntry.count({ where: { action: "WORKER_CREDENTIAL_REVOKED" } })).toBe(0);
    await registry.revokeWorkspace(fixture.ownerActor, registration.workerId, "workspace-a", "revoke-local-a");

    expect(await registry.isAuthorized(registration.workerId, { type: "WORKSPACE", id: "workspace-a" })).toBe(false);
    expect(await registry.isAuthorized(registration.workerId, { type: "BRAND", id: "brand-b1" })).toBe(true);
    await expect(credentials.authenticate(issued.credential)).resolves.toMatchObject({ workerId: registration.workerId });
  });

  it("denies tenant-scoped issuance when an active Worker has zero active grants", async () => {
    await expect(credentials.issue(
      fixture.ownerActor, registration.workerId, { type: "WORKSPACE", id: "workspace-a" }, DAY_MS, "issue-zero-grant",
    )).rejects.toThrow("WORKER_ACTIVE_GRANT_REQUIRED");
    expect(await fixture.db.workerCredential.count()).toBe(0);
  });

  it("keeps every self-rotation inside the original credential-family expiry", async () => {
    await registry.grantWorkspace(fixture.ownerActor, registration.workerId, "workspace-a", "grant-a");
    const issued = await credentials.issue(
      fixture.ownerActor, registration.workerId, { type: "WORKSPACE", id: "workspace-a" }, 90 * DAY_MS, "issue-family",
    );
    clock.advance(90 * DAY_MS - 60 * 60 * 1_000);
    const firstRotation = await credentials.rotate(issued.credential, 10 * 60 * 1_000, 90 * DAY_MS, "rotate-family-1");
    expect(firstRotation.expiresAt).toEqual(issued.expiresAt);

    clock.advance(30 * 60 * 1_000);
    const secondRotation = await credentials.rotate(firstRotation.credential, 10 * 60 * 1_000, 90 * DAY_MS, "rotate-family-2");
    expect(secondRotation.expiresAt).toEqual(issued.expiresAt);

    clock.advance(30 * 60 * 1_000 + 1);
    await expect(credentials.authenticate(firstRotation.credential)).rejects.toThrow("AUTH_CREDENTIAL_EXPIRED");
    await expect(credentials.authenticate(secondRotation.credential)).rejects.toThrow("AUTH_CREDENTIAL_EXPIRED");
  });

  it("requires human-governed re-enrollment to start a fresh bounded family", async () => {
    await registry.grantWorkspace(fixture.ownerActor, registration.workerId, "workspace-a", "grant-a");
    const expired = await credentials.issue(
      fixture.ownerActor, registration.workerId, { type: "WORKSPACE", id: "workspace-a" }, 60_000, "issue-old-family",
    );
    clock.advance(60_001);
    const reEnrolled = await credentials.issue(
      fixture.ownerActor, registration.workerId, { type: "WORKSPACE", id: "workspace-a" }, 90 * DAY_MS, "issue-new-family",
    );

    await expect(credentials.authenticate(expired.credential)).rejects.toThrow("AUTH_CREDENTIAL_EXPIRED");
    await expect(credentials.authenticate(reEnrolled.credential)).resolves.toMatchObject({ workerId: registration.workerId });
    expect(reEnrolled.expiresAt).toEqual(new Date(clock.now().getTime() + 90 * DAY_MS));
  });

  it("does not let bearer-only theft extend trust or mutate governance", async () => {
    await registry.grantWorkspace(fixture.ownerActor, registration.workerId, "workspace-a", "grant-a");
    const issued = await credentials.issue(
      fixture.ownerActor, registration.workerId, { type: "WORKSPACE", id: "workspace-a" }, DAY_MS, "issue-stolen",
    );
    clock.advance(12 * 60 * 60 * 1_000);
    const rotated = await credentials.rotate(issued.credential, 0, 90 * DAY_MS, "attacker-rotate");
    expect(rotated.expiresAt).toEqual(issued.expiresAt);

    const bearerActor = { provider: "bearer", subject: issued.credential };
    await expect(credentials.issue(
      bearerActor, registration.workerId, { type: "WORKSPACE", id: "workspace-a" }, 90 * DAY_MS, "attacker-enroll",
    )).rejects.toThrow("PERMISSION_DENIED");
    await expect(registry.revokeWorkspace(
      bearerActor, registration.workerId, "workspace-a", "attacker-revoke-grant",
    )).rejects.toThrow("PERMISSION_DENIED");
    expect(await fixture.db.workerCapability.findMany({ where: { workerId: registration.workerId } })).toHaveLength(1);
    expect(await registry.isAuthorized(registration.workerId, { type: "WORKSPACE", id: "workspace-a" })).toBe(true);
  });

  it("keeps credential revocation record-specific across rotation", async () => {
    await registry.grantWorkspace(fixture.ownerActor, registration.workerId, "workspace-a", "grant-a");
    const issued = await credentials.issue(
      fixture.ownerActor, registration.workerId, { type: "WORKSPACE", id: "workspace-a" }, DAY_MS, "issue-specific-revoke",
    );
    const replacement = await credentials.rotate(issued.credential, 10 * 60 * 1_000, DAY_MS, "rotate-specific-revoke");

    await credentials.revoke(
      fixture.ownerActor, issued.credentialId, { type: "WORKSPACE", id: "workspace-a" }, "revoke-old-record",
    );
    await expect(credentials.authenticate(issued.credential)).rejects.toThrow("AUTH_CREDENTIAL_REVOKED");
    await expect(credentials.authenticate(replacement.credential)).resolves.toMatchObject({ workerId: registration.workerId });
  });
});
