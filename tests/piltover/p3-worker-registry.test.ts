import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaWorkerRegistry } from "@/lib/piltover/modules/workers/infrastructure/prisma-worker-registry";
import type { P3Fixture } from "./p3-test-db";
import { createP3Fixture } from "./p3-test-db";

const registration = {
  schemaVersion: "1.0" as const,
  workerId: "worker-a",
  deviceName: "Owner workstation",
  os: "windows",
  capabilities: ["git", "filesystem:scoped"],
  runtime: { adapter: "future-runtime", version: "1.0.0", protocolVersion: "1.0" },
  repoMappings: { piltover: "repo:piltover" },
};

describe("P3 Worker registry and exact tenant grants", () => {
  let fixture: P3Fixture;
  let registry: PrismaWorkerRegistry;

  beforeEach(async () => {
    fixture = await createP3Fixture();
    let tick = 0;
    registry = new PrismaWorkerRegistry(fixture.db, {
      now: () => new Date(Date.parse("2026-09-06T00:00:00.000Z") + tick++ * 1_000),
    });
    await registry.register(registration, new Date("2026-09-06T00:00:00.000Z"));
  }, 20_000);

  afterEach(async () => {
    await fixture.database.dispose();
  });

  it("persists normalized capabilities without granting tenant authority", async () => {
    const worker = await registry.get("worker-a");
    expect(worker?.capabilities).toEqual(["filesystem:scoped", "git"]);
    expect(await registry.isAuthorized("worker-a", { type: "WORKSPACE", id: "workspace-a" })).toBe(false);
    expect(Object.keys(worker ?? {})).not.toContain("credential");
  });

  it("rejects obvious secret-bearing registration metadata", async () => {
    await expect(registry.register({
      ...registration, workerId: "worker-secret", repoMappings: { apiKey: "must-not-store" },
    })).rejects.toThrow("WORKER_SECRET_METADATA_REJECTED");
    expect(await fixture.db.worker.findUnique({ where: { id: "worker-secret" } })).toBeNull();
  });

  it("enforces exact Workspace and Brand grants without inheritance", async () => {
    await registry.grantWorkspace(fixture.ownerActor, "worker-a", "workspace-a", "correlation-1");
    expect(await registry.isAuthorized("worker-a", { type: "WORKSPACE", id: "workspace-a" })).toBe(true);
    expect(await registry.isAuthorized("worker-a", { type: "BRAND", id: "brand-a1" })).toBe(false);
    expect(await registry.isAuthorized("worker-a", { type: "WORKSPACE", id: "workspace-a2" })).toBe(false);

    await registry.grantBrand(fixture.ownerActor, "worker-a", "brand-a1", "correlation-2");
    expect(await registry.isAuthorized("worker-a", { type: "BRAND", id: "brand-a1" })).toBe(true);
    expect(await registry.isAuthorized("worker-a", { type: "BRAND", id: "brand-a2" })).toBe(false);
    expect(await registry.isAuthorized("worker-a", { type: "WORKSPACE", id: "workspace-a" })).toBe(true);
  });

  it("denies a foreign actor granting access outside their exact tenant", async () => {
    await expect(
      registry.grantBrand(fixture.foreignActor, "worker-a", "brand-a1", "correlation-foreign"),
    ).rejects.toThrow("PERMISSION_DENIED");
    expect(await fixture.db.workerBrandGrant.count()).toBe(0);
  });

  it("preserves grant, revoke, re-grant, and second revoke chronology", async () => {
    await registry.grantBrand(fixture.ownerActor, "worker-a", "brand-a1", "correlation-1");
    await registry.revokeBrand(fixture.ownerActor, "worker-a", "brand-a1", "correlation-2");
    await registry.grantBrand(fixture.ownerActor, "worker-a", "brand-a1", "correlation-3");
    await registry.revokeBrand(fixture.ownerActor, "worker-a", "brand-a1", "correlation-4");

    const history = await fixture.db.auditEntry.findMany({
      where: { targetType: "WORKER_BRAND_GRANT", targetId: "worker-a:brand-a1" },
      orderBy: { occurredAt: "asc" },
    });
    expect(history.map(({ action }) => action)).toEqual([
      "WORKER_BRAND_GRANTED",
      "WORKER_BRAND_REVOKED",
      "WORKER_BRAND_REGRANTED",
      "WORKER_BRAND_REVOKED",
    ]);
    expect(history.map(({ actorId }) => actorId)).toEqual([
      "identity-owner",
      "identity-owner",
      "identity-owner",
      "identity-owner",
    ]);
  });

  it("records Worker disable without storing a machine credential", async () => {
    await registry.disable("worker-a", "platform-owner", "disable-worker-a");
    expect((await registry.get("worker-a"))?.status).toBe("DISABLED");
    const audit = await fixture.db.auditEntry.findFirstOrThrow({
      where: { action: "WORKER_DISABLED", targetId: "worker-a" },
    });
    expect(audit.actorId).toBe("platform-owner");
    expect(audit.organizationId).toBeNull();
  });
});
