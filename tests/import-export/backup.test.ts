// M10 — full-DB backup export/import. Two concerns proven here:
//   1) backupEnvelopeSchema rejects a corrupt file BEFORE any DB write (pure, hermetic).
//   2) export → JSON round-trip → mutate → import → export is loss-less (real SQLite DB).
//
// Temp-DB approach: we create a SEPARATE throwaway SQLite file inside prisma/ and run
// `prisma db push` against it via the direct node binary path (the rtk hook + PATH break
// `npx` in this environment, per M10 notes). The temp file lives in prisma/ so the schema's
// relative `env("DATABASE_URL")` = "file:./<name>.db" resolves the same way dev.db does.
// The dev DB (prisma/dev.db) is NEVER touched: the PrismaClient is instantiated with an
// explicit datasources.db.url pointing only at the temp file, and lib/db.ts (the dev-bound
// singleton) is intentionally NOT imported. afterAll deletes the temp file (+ -journal/-wal).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  exportBackup,
  importBackup,
  backupEnvelopeSchema,
  IMPORT_ORDER,
  type BackupEnvelope,
} from "@/lib/import-export/backup";
import { seedCore } from "@/prisma/seedCore";

// ---------------------------------------------------------------------------
// 1. backupEnvelopeSchema validation — pure, no DB. Proves "file sai → reject".
// ---------------------------------------------------------------------------
describe("backupEnvelopeSchema (structure validation, no DB)", () => {
  // A minimally well-formed envelope: every model name maps to an array.
  const wellFormed = {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: Object.fromEntries(IMPORT_ORDER.map((m) => [m, []])),
  };

  it("accepts a well-formed envelope (version, exportedAt, data of model arrays)", () => {
    const parsed = backupEnvelopeSchema.safeParse(wellFormed);
    expect(parsed.success).toBe(true);
  });

  it("accepts a well-formed envelope carrying rows (record objects)", () => {
    const withRows = {
      ...wellFormed,
      data: { ...wellFormed.data, UserProfile: [{ id: "local", name: "X" }] },
    };
    expect(backupEnvelopeSchema.safeParse(withRows).success).toBe(true);
  });

  it("REJECTS an envelope missing `data`", () => {
    const bad = { version: 1, exportedAt: new Date().toISOString() };
    expect(backupEnvelopeSchema.safeParse(bad).success).toBe(false);
  });

  it("REJECTS `data` that is not an object (array)", () => {
    const bad = { version: 1, exportedAt: new Date().toISOString(), data: [] };
    expect(backupEnvelopeSchema.safeParse(bad).success).toBe(false);
  });

  it("REJECTS an envelope missing `version`", () => {
    const bad = { exportedAt: new Date().toISOString(), data: wellFormed.data };
    expect(backupEnvelopeSchema.safeParse(bad).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Round-trip "no data loss" against a REAL throwaway SQLite DB.
// ---------------------------------------------------------------------------
const TEMP_DB_NAME = "test-backup.db";
const TEMP_DB_URL = `file:./${TEMP_DB_NAME}`; // relative to prisma/ (schema dir)
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

// Normalize Date objects (exportBackup returns raw Prisma rows with Dates) to ISO strings
// so a live export can be compared field-for-field with a JSON round-tripped envelope.
function normalize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

let prisma: PrismaClient;

beforeAll(async () => {
  // Start clean: remove any leftover temp DB from a previous aborted run.
  removeTempDb();

  // Create the schema on the temp file. --skip-generate: client already generated.
  execSync(`node "${PRISMA_CLI}" db push --skip-generate`, {
    env: { ...process.env, DATABASE_URL: TEMP_DB_URL },
    stdio: "pipe",
  });

  // Fresh client bound ONLY to the temp file — dev.db is never referenced.
  prisma = new PrismaClient({ datasources: { db: { url: TEMP_DB_URL } } });
  await seedCore(prisma, "khang-guru");
}, 120_000);

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
  removeTempDb();
});

function removeTempDb() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    fs.rmSync(TEMP_DB_FILE + suffix, { force: true });
  }
}

// Count total rows across all 22 models in an envelope's data.
function rowCounts(env: BackupEnvelope): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const model of IMPORT_ORDER) counts[model] = env.data[model]?.length ?? 0;
  return counts;
}

describe("exportBackup → import round-trip is loss-less (real temp SQLite DB)", () => {
  it("restores exact row counts and field values after a destructive mutation", async () => {
    // Baseline export, then simulate write-to-file/read-from-file via JSON round-trip
    // (this is what turns Date objects into ISO strings, matching a real backup file).
    const before = normalize(await exportBackup(prisma));
    const beforeCounts = rowCounts(before);

    // Sanity: the seed actually populated something to restore.
    expect(beforeCounts.UserProfile).toBe(1);
    const originalName = before.data.UserProfile[0].name as string;
    expect(originalName).toBe("Khang Guru");

    // --- MUTATE the live DB: corrupt a field AND delete rows. ---
    await prisma.userProfile.update({
      where: { id: "local" },
      data: { name: "CORRUPTED — should be reverted" },
    });
    await prisma.framework.deleteMany(); // wipe all 4 frameworks

    // Confirm the mutation landed (guards against a no-op "always passes" test).
    const mutatedName = (await prisma.userProfile.findUniqueOrThrow({ where: { id: "local" } })).name;
    expect(mutatedName).toBe("CORRUPTED — should be reverted");
    expect(await prisma.framework.count()).toBe(0);

    // --- RESTORE from the backup envelope (upsert re-creates deleted, reverts changed). ---
    await importBackup(prisma, before);

    // --- Verify no data loss: fresh export deep-equals the baseline. ---
    const after = normalize(await exportBackup(prisma));

    // Row counts per table identical.
    expect(rowCounts(after)).toEqual(beforeCounts);

    // Spot-check: the corrupted field is back to its original value.
    expect(after.data.UserProfile[0].name).toBe(originalName);

    // Spot-check: the deleted frameworks are fully restored (by slug + fields).
    const beforeFw = [...before.data.Framework].sort((a, b) =>
      String(a.slug).localeCompare(String(b.slug)),
    );
    const afterFw = [...after.data.Framework].sort((a, b) =>
      String(a.slug).localeCompare(String(b.slug)),
    );
    expect(afterFw).toEqual(beforeFw);
  });
});
