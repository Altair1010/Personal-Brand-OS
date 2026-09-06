import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import { createMigrationWorkspace, createPreP4MigrationWorkspace, deployMigrations } from "./p2-test-db";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    const resolved = path.resolve(root);
    if (!resolved.startsWith(path.resolve(process.env.TEMP ?? process.env.TMP ?? "") + path.sep)) throw new Error("Unsafe test cleanup path.");
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});

describe("P4 additive WorkerCredential migration", () => {
  it("deploys on a fresh database and is idempotent on second deploy", () => {
    const workspace = createMigrationWorkspace(); roots.push(workspace.root);
    deployMigrations(workspace.schemaPath, workspace.url);
    deployMigrations(workspace.schemaPath, workspace.url);
  });

  it("preserves populated canonical P3 data", async () => {
    const workspace = createPreP4MigrationWorkspace(); roots.push(workspace.root);
    deployMigrations(workspace.schemaPath, workspace.url);
    const db = new PrismaClient({ datasources: { db: { url: workspace.url } } });
    await db.userIdentity.create({ data: { id: "identity-a" } });
    await db.organization.create({ data: { id: "org-a", name: "Organization A" } });
    await db.workspace.create({ data: { id: "workspace-a", organizationId: "org-a", name: "Workspace A" } });
    await db.worker.create({ data: {
      id: "worker-a", deviceName: "Worker A", runtimeAdapter: "codex-app-server", runtimeVersion: "0.153.4",
    } });
    const before = {
      users: await db.userIdentity.count(), organizations: await db.organization.count(),
      workspaces: await db.workspace.count(), workers: await db.worker.count(),
    };
    await db.$disconnect();

    const migrationSource = path.resolve(__dirname, "..", "..", "prisma", "migrations", "20260906070000_add_piltover_worker_credentials");
    fs.cpSync(migrationSource, path.join(workspace.migrationsPath, path.basename(migrationSource)), { recursive: true });
    deployMigrations(workspace.schemaPath, workspace.url);
    deployMigrations(workspace.schemaPath, workspace.url);

    const reopened = new PrismaClient({ datasources: { db: { url: workspace.url } } });
    expect({
      users: await reopened.userIdentity.count(), organizations: await reopened.organization.count(),
      workspaces: await reopened.workspace.count(), workers: await reopened.worker.count(),
    }).toEqual(before);
    expect(await reopened.workerCredential.count()).toBe(0);
    await reopened.$disconnect();
  }, 30_000);
});
