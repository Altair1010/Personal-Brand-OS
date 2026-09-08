import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import { createMigrationWorkspace, deployMigrations } from "./p2-test-db";

const MIGRATION_NAME = "20260908090000_add_p5_agent_registries";
const roots: string[] = [];

function createPreP5Workspace() {
  const workspace = createMigrationWorkspace();
  fs.rmSync(path.join(workspace.root, "prisma", "migrations", MIGRATION_NAME), { recursive: true, force: true });
  return workspace;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    const resolved = path.resolve(root);
    const tempRoot = path.resolve(process.env.TEMP ?? process.env.TMP ?? "");
    if (!resolved.startsWith(tempRoot + path.sep)) throw new Error("Unsafe test cleanup path.");
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});

describe("P5 Agent registry forward migration", () => {
  it("deploys on a fresh database, preserves partial uniqueness, and is safe on second deploy", async () => {
    const workspace = createMigrationWorkspace();
    roots.push(workspace.root);
    deployMigrations(workspace.schemaPath, workspace.url);
    deployMigrations(workspace.schemaPath, workspace.url);

    const db = new PrismaClient({ datasources: { db: { url: workspace.url } } });
    try {
      const objects = await db.$queryRawUnsafe<Array<{ type: string; name: string }>>(
        `SELECT type, name FROM sqlite_master WHERE name LIKE 'AgentDefinition%' OR name LIKE 'AgentRole%' ORDER BY type, name`,
      );
      expect(objects.map(({ name }) => name)).toEqual(expect.arrayContaining([
        "AgentDefinition",
        "AgentDefinitionVersion",
        "AgentDefinitionVersion_one_published",
        "AgentRole",
        "AgentRoleVersion",
        "AgentRoleVersion_one_published",
      ]));
      expect(await db.$queryRawUnsafe<Array<{ foreign_key_check: unknown }>>("PRAGMA foreign_key_check")).toEqual([]);
    } finally {
      await db.$disconnect();
    }
  }, 30_000);

  it("rejects invalid owner-scope shapes and mismatched tenant ancestry at the database boundary", async () => {
    const workspace = createMigrationWorkspace();
    roots.push(workspace.root);
    deployMigrations(workspace.schemaPath, workspace.url);
    const db = new PrismaClient({ datasources: { db: { url: workspace.url } } });
    try {
      await db.organization.createMany({ data: [{ id: "org-a", name: "A" }, { id: "org-b", name: "B" }] });
      await db.workspace.create({ data: { id: "workspace-b", organizationId: "org-b", name: "B" } });
      await expect(db.$executeRawUnsafe(
        `INSERT INTO AgentDefinition (id,name,ownerScope,organizationId,status,revision,createdAt,updatedAt) VALUES ('bad-platform','Bad','PLATFORM','org-a','ACTIVE',0,0,0)`,
      )).rejects.toThrow();
      await expect(db.$executeRawUnsafe(
        `INSERT INTO AgentDefinition (id,name,ownerScope,organizationId,workspaceId,status,revision,createdAt,updatedAt) VALUES ('bad-workspace','Bad','WORKSPACE','org-a','workspace-b','ACTIVE',0,0,0)`,
      )).rejects.toThrow();
    } finally {
      await db.$disconnect();
    }
  }, 30_000);

  it("preserves populated P2, P3, and P4 rows without creating guessed P5 identities", async () => {
    const workspace = createPreP5Workspace();
    roots.push(workspace.root);
    deployMigrations(workspace.schemaPath, workspace.url);
    let db = new PrismaClient({ datasources: { db: { url: workspace.url } } });
    await db.userIdentity.create({ data: { id: "identity-a" } });
    await db.organization.create({ data: { id: "org-a", name: "Organization A" } });
    await db.workspace.create({ data: { id: "workspace-a", organizationId: "org-a", name: "Workspace A" } });
    await db.brand.create({ data: { id: "brand-a", organizationId: "org-a", workspaceId: "workspace-a", name: "Brand A" } });
    await db.membership.create({ data: {
      id: "membership-a", userIdentityId: "identity-a", organizationId: "org-a", organizationRole: "OWNER",
    } });
    await db.agentRun.create({ data: {
      id: "run-a", organizationId: "org-a", workspaceId: "workspace-a", brandId: "brand-a",
      roleRef: "opaque-role", task: { type: "test" }, contextRef: { id: "opaque-context" },
      permissionManifestRef: "opaque-manifest", requiredCapabilities: [], requestFingerprint: "run-fingerprint",
      correlationId: "corr-run",
    } });
    await db.worker.create({ data: {
      id: "worker-a", deviceName: "Worker A", runtimeAdapter: "codex-app-server", runtimeVersion: "0.153.4",
    } });
    await db.workerWorkspaceGrant.create({ data: {
      id: "grant-a", workerId: "worker-a", organizationId: "org-a", workspaceId: "workspace-a",
      grantedAt: new Date("2026-09-08T00:00:00.000Z"), grantedByUserIdentityId: "identity-a",
    } });
    await db.workerCredential.create({ data: {
      id: "credential-a", workerId: "worker-a", secretVerifier: "aa".repeat(32),
      issuedAt: new Date("2026-09-08T00:00:00.000Z"), expiresAt: new Date("2026-12-01T00:00:00.000Z"),
      familyExpiresAt: new Date("2026-12-01T00:00:00.000Z"), createdByUserIdentityId: "identity-a",
    } });
    await db.job.create({ data: {
      id: "job-a", runId: "run-a", organizationId: "org-a", workspaceId: "workspace-a", brandId: "brand-a",
      requiredCapabilities: [], idempotencyKey: "job-a",
    } });
    await db.workerLease.create({ data: {
      id: "lease-a", jobId: "job-a", workerId: "worker-a", generation: 1, attemptNumber: 1,
      issuedAt: new Date("2026-09-08T00:00:00.000Z"), expiresAt: new Date("2026-09-08T00:10:00.000Z"),
    } });
    await db.approvalRequest.create({ data: {
      id: "approval-a", organizationId: "org-a", runId: "run-a", actionType: "TEST", targetRef: "target-a",
      targetType: "BRAND", workspaceId: "workspace-a", brandId: "brand-a", requiredCapability: "agent.manage",
      payloadHash: "payload-hash", requestedByUserIdentityId: "identity-a", expiresAt: new Date("2026-09-09T00:00:00.000Z"),
      oneTimeNonce: "nonce-a",
    } });
    await db.auditEntry.create({ data: {
      id: "audit-a", organizationId: "org-a", actorType: "HUMAN", actorId: "identity-a",
      action: "BASELINE", targetType: "ORGANIZATION", targetId: "org-a", correlationId: "corr-audit",
      occurredAt: new Date("2026-09-08T00:00:00.000Z"),
    } });
    const before = {
      identities: await db.userIdentity.count(), organizations: await db.organization.count(),
      workspaces: await db.workspace.count(), brands: await db.brand.count(), memberships: await db.membership.count(),
      runs: await db.agentRun.count(), jobs: await db.job.count(), approvals: await db.approvalRequest.count(),
      workers: await db.worker.count(), grants: await db.workerWorkspaceGrant.count(),
      credentials: await db.workerCredential.count(), leases: await db.workerLease.count(), audits: await db.auditEntry.count(),
    };
    await db.$disconnect();

    const migrationSource = path.resolve(process.cwd(), "prisma", "migrations", MIGRATION_NAME);
    fs.cpSync(migrationSource, path.join(workspace.root, "prisma", "migrations", MIGRATION_NAME), { recursive: true });
    deployMigrations(workspace.schemaPath, workspace.url);
    deployMigrations(workspace.schemaPath, workspace.url);

    db = new PrismaClient({ datasources: { db: { url: workspace.url } } });
    try {
      expect({
        identities: await db.userIdentity.count(), organizations: await db.organization.count(),
        workspaces: await db.workspace.count(), brands: await db.brand.count(), memberships: await db.membership.count(),
        runs: await db.agentRun.count(), jobs: await db.job.count(), approvals: await db.approvalRequest.count(),
        workers: await db.worker.count(), grants: await db.workerWorkspaceGrant.count(),
        credentials: await db.workerCredential.count(), leases: await db.workerLease.count(), audits: await db.auditEntry.count(),
      }).toEqual(before);
      expect(await db.agentDefinition.count()).toBe(0);
      expect(await db.agentRole.count()).toBe(0);
      expect(await db.$queryRawUnsafe<Array<{ foreign_key_check: unknown }>>("PRAGMA foreign_key_check")).toEqual([]);
    } finally {
      await db.$disconnect();
    }
  }, 30_000);
});
