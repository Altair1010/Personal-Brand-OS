// EM2b T7 — setDefaultModelConfig. Proves, on a real throwaway SQLite DB, that setting a
// config as default unsets every other default (exactly one isDefault=true) and creates NO
// new row. lib/db is mocked to the temp client; next/cache is stubbed (no request context).
//
// Temp-DB approach mirrors tests/cloud-backup/cloud-backup.test.ts.

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const holder = vi.hoisted(() => ({
  client: null as unknown as PrismaClient,
}));

vi.mock("@/lib/db", () => ({
  get db() {
    return holder.client;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { setDefaultModelConfig } from "@/app/(dashboard)/settings/actions";

const TEMP_DB_NAME = "test-set-default.db";
const TEMP_DB_URL = `file:./${TEMP_DB_NAME}`;
const PRISMA_DIR = path.resolve(__dirname, "..", "..", "prisma");
const TEMP_DB_FILE = path.join(PRISMA_DIR, TEMP_DB_NAME);
const PRISMA_CLI = path.resolve(
  __dirname,
  "..",
  "..",
  "node_modules",
  "prisma",
  "build",
  "index.js",
);

function removeTempDb() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    fs.rmSync(TEMP_DB_FILE + suffix, { force: true });
  }
}

beforeAll(async () => {
  removeTempDb();
  execSync(`node "${PRISMA_CLI}" db push --skip-generate`, {
    env: { ...process.env, DATABASE_URL: TEMP_DB_URL },
    stdio: "pipe",
  });
  holder.client = new PrismaClient({
    datasources: { db: { url: TEMP_DB_URL } },
  });
}, 120_000);

afterAll(async () => {
  if (holder.client) await holder.client.$disconnect();
  removeTempDb();
});

describe("setDefaultModelConfig (real temp SQLite)", () => {
  it("moves the default to the target, leaving exactly one default and no new row", async () => {
    const db = holder.client;
    const a = await db.aIModelConfig.create({
      data: { provider: "anthropic", model: "m-a", isDefault: true },
    });
    const b = await db.aIModelConfig.create({
      data: { provider: "openai", model: "m-b", isDefault: false },
    });

    const res = await setDefaultModelConfig(b.id);
    expect(res.ok).toBe(true);

    const rows = await db.aIModelConfig.findMany();
    expect(rows.length).toBe(2); // no new row created
    const defaults = rows.filter((r) => r.isDefault);
    expect(defaults.length).toBe(1);
    expect(defaults[0].id).toBe(b.id);
    // old default flipped off
    expect(rows.find((r) => r.id === a.id)!.isDefault).toBe(false);
  });

  it("returns an error for an unknown id and leaves defaults unchanged", async () => {
    const db = holder.client;
    const before = await db.aIModelConfig.findMany();
    const beforeDefault = before.find((r) => r.isDefault)?.id;

    const res = await setDefaultModelConfig("does-not-exist");
    expect(res.ok).toBe(false);

    const after = await db.aIModelConfig.findMany();
    expect(after.filter((r) => r.isDefault).length).toBe(1);
    expect(after.find((r) => r.isDefault)?.id).toBe(beforeDefault);
  });
});
