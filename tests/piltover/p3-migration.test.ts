import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { createDisposableP2Database } from "./p2-test-db";
import { createPreP3MigrationWorkspace, deployMigrations } from "./p2-test-db";

const P3_TABLES = [
  "AgentRun",
  "ApprovalRequest",
  "AuditEntry",
  "Job",
  "RunEvent",
  "Worker",
  "WorkerBrandGrant",
  "WorkerCapability",
  "WorkerLease",
  "WorkerWorkspaceGrant",
] as const;

describe("P3 control-plane migration", () => {
  it("adds only the durable control-plane tables to a fresh database", async () => {
    const database = await createDisposableP2Database();
    try {
      const tables = await database.client.$queryRawUnsafe<Array<{ name: string }>>(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
      );

      expect(tables.map(({ name }) => name)).toEqual(
        expect.arrayContaining([...P3_TABLES]),
      );
    } finally {
      await database.dispose();
    }
  }, 20_000);

  it("preserves populated P2 rows and permits a second deploy", async () => {
    const workspace = createPreP3MigrationWorkspace();
    let client = new PrismaClient({ datasources: { db: { url: workspace.url } } });

    try {
      deployMigrations(workspace.schemaPath, workspace.url);
      await client.userIdentity.create({ data: { id: "identity-p2" } });
      await client.organization.create({ data: { id: "org-p2", name: "P2 organization" } });
      await client.workspace.create({
        data: { id: "workspace-p2", organizationId: "org-p2", name: "P2 workspace" },
      });
      await client.brand.create({
        data: {
          id: "brand-p2",
          organizationId: "org-p2",
          workspaceId: "workspace-p2",
          name: "P2 brand",
        },
      });
      await client.membership.create({
        data: {
          id: "membership-p2",
          userIdentityId: "identity-p2",
          organizationId: "org-p2",
          organizationRole: "OWNER",
        },
      });

      const before = await Promise.all([
        client.userIdentity.count(),
        client.organization.count(),
        client.workspace.count(),
        client.brand.count(),
        client.membership.count(),
      ]);
      await client.$disconnect();

      const source = path.resolve(
        __dirname,
        "..",
        "..",
        "prisma",
        "migrations",
        "20260906040000_add_piltover_control_plane",
      );
      fs.cpSync(source, path.join(workspace.migrationsPath, path.basename(source)), {
        recursive: true,
      });
      deployMigrations(workspace.schemaPath, workspace.url);
      deployMigrations(workspace.schemaPath, workspace.url);

      client = new PrismaClient({ datasources: { db: { url: workspace.url } } });
      const after = await Promise.all([
        client.userIdentity.count(),
        client.organization.count(),
        client.workspace.count(),
        client.brand.count(),
        client.membership.count(),
      ]);
      const foreignKeyViolations = await client.$queryRawUnsafe<unknown[]>(
        "PRAGMA foreign_key_check",
      );

      expect(after).toEqual(before);
      expect(foreignKeyViolations).toEqual([]);
    } finally {
      await client.$disconnect();
      const tempRoot = path.resolve(workspace.root);
      const expectedPrefix = path.resolve(path.dirname(workspace.root)) + path.sep;
      if (!tempRoot.startsWith(expectedPrefix)) throw new Error("Refusing to delete non-temp path.");
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 20_000);
});
