import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const PRISMA_CLI = path.join(REPO_ROOT, "node_modules", "prisma", "build", "index.js");
const SCHEMA = path.join(REPO_ROOT, "prisma", "schema.prisma");
const MIGRATIONS = path.join(REPO_ROOT, "prisma", "migrations");

export type DisposableP2Database = {
  readonly client: PrismaClient;
  readonly root: string;
  readonly url: string;
  dispose(): Promise<void>;
};

export function deployMigrations(schemaPath: string, url: string): void {
  execFileSync(process.execPath, [PRISMA_CLI, "migrate", "deploy", "--schema", schemaPath], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}

export function createMigrationWorkspace(includeP2 = true): {
  readonly root: string;
  readonly schemaPath: string;
  readonly url: string;
} {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "piltover-p2-"));
  const prismaDir = path.join(root, "prisma");
  fs.mkdirSync(prismaDir);
  fs.copyFileSync(SCHEMA, path.join(prismaDir, "schema.prisma"));
  fs.cpSync(MIGRATIONS, path.join(prismaDir, "migrations"), {
    recursive: true,
    filter: (source) => includeP2 || !source.includes("20260906004200_add_piltover_tenancy_rbac"),
  });
  const dbPath = path.join(root, "p2.db");
  return {
    root,
    schemaPath: path.join(prismaDir, "schema.prisma"),
    url: `file:${dbPath.replaceAll("\\", "/")}`,
  };
}

export async function createDisposableP2Database(): Promise<DisposableP2Database> {
  const workspace = createMigrationWorkspace();
  deployMigrations(workspace.schemaPath, workspace.url);
  const client = new PrismaClient({ datasources: { db: { url: workspace.url } } });
  return {
    ...workspace,
    client,
    async dispose() {
      await client.$disconnect();
      const expectedPrefix = path.resolve(os.tmpdir()) + path.sep;
      const resolved = path.resolve(workspace.root);
      if (!resolved.startsWith(expectedPrefix)) throw new Error("Refusing to delete non-temp path.");
      fs.rmSync(resolved, { recursive: true, force: true });
    },
  };
}
