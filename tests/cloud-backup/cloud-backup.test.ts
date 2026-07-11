// EM1b — cloud snapshot. Proves, hermetically (no network / no Supabase):
//   1) stripSecrets nulls AIModelConfig.apiKey + AppState.supabaseUserId (secret exclusion).
//   2) encryptSnapshot → decryptSnapshot round-trips; wrong passphrase / bad format throw.
//   3) Full pipeline on a REAL throwaway SQLite DB: seed → set secrets → export → strip →
//      encrypt → decrypt → validate → import restores data with secret fields still null.
//
// Same temp-DB approach as tests/import-export/backup.test.ts: a separate SQLite file in
// prisma/ with an explicit datasources url; dev.db is never touched; lib/db.ts not imported.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { exportBackup, importBackup, backupEnvelopeSchema } from "@/lib/import-export/backup";
import {
  stripSecrets,
  encryptSnapshot,
  decryptSnapshot,
  STRIP_FIELDS,
} from "@/lib/cloud-backup";
import { seedCore } from "@/prisma/seedCore";

// ---------------------------------------------------------------------------
// 1 + 2. Pure functions — no DB.
// ---------------------------------------------------------------------------
describe("encryptSnapshot / decryptSnapshot (pure)", () => {
  const pass = "correct horse battery";
  const json = JSON.stringify({ hello: "world", n: 42 });

  it("round-trips json with the right passphrase", () => {
    const blob = encryptSnapshot(json, pass);
    expect(Buffer.isBuffer(blob)).toBe(true);
    expect(decryptSnapshot(blob, pass)).toBe(json);
  });

  it("produces a different blob each time (random salt+iv) but both decrypt", () => {
    const a = encryptSnapshot(json, pass);
    const b = encryptSnapshot(json, pass);
    expect(a.equals(b)).toBe(false);
    expect(decryptSnapshot(a, pass)).toBe(json);
    expect(decryptSnapshot(b, pass)).toBe(json);
  });

  it("THROWS on a wrong passphrase (GCM auth fail)", () => {
    const blob = encryptSnapshot(json, pass);
    expect(() => decryptSnapshot(blob, "wrong passphrase")).toThrow();
  });

  it("THROWS on a blob with a bad format sentinel", () => {
    const bogus = Buffer.from("not a real snapshot blob at all");
    expect(() => decryptSnapshot(bogus, pass)).toThrow();
  });
});

describe("stripSecrets (pure)", () => {
  it("nulls configured secret fields, keeps rows and other fields", () => {
    const envelope = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        AIModelConfig: [{ id: "c1", provider: "anthropic", model: "x", apiKey: "SECRET" }],
        AppState: [{ id: "singleton", supabaseUserId: "user-123", activeGoalId: "g1" }],
      },
    } as unknown as Parameters<typeof stripSecrets>[0];

    const out = stripSecrets(envelope);
    expect(out.data.AIModelConfig[0].apiKey).toBeNull();
    expect(out.data.AIModelConfig[0].model).toBe("x"); // untouched
    expect(out.data.AppState[0].supabaseUserId).toBeNull();
    expect(out.data.AppState[0].activeGoalId).toBe("g1"); // untouched
    // original not mutated (deep clone)
    expect(envelope.data.AIModelConfig[0].apiKey).toBe("SECRET");
  });

  it("declares apiKey as a stripped AIModelConfig field", () => {
    expect(STRIP_FIELDS.AIModelConfig).toContain("apiKey");
  });
});

// ---------------------------------------------------------------------------
// 3. Full pipeline on a real temp SQLite DB.
// ---------------------------------------------------------------------------
const TEMP_DB_NAME = "test-cloud-backup.db";
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

let prisma: PrismaClient;

beforeAll(async () => {
  removeTempDb();
  execSync(`node "${PRISMA_CLI}" db push --skip-generate`, {
    env: { ...process.env, DATABASE_URL: TEMP_DB_URL },
    stdio: "pipe",
  });
  prisma = new PrismaClient({ datasources: { db: { url: TEMP_DB_URL } } });
  await seedCore(prisma, "khang-guru");
}, 120_000);

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
  removeTempDb();
});

describe("cloud snapshot pipeline (real temp SQLite)", () => {
  const passphrase = "a-strong-passphrase-1";

  it("export → strip → encrypt → decrypt → import: data restored, secrets excluded", async () => {
    // Plant secrets in the local DB.
    await prisma.aIModelConfig.updateMany({ data: { apiKey: "v1:ENCRYPTED-KEY-BLOB" } });
    await prisma.appState.update({
      where: { id: "singleton" },
      data: { supabaseUserId: "supa-user-abc" },
    });

    // Export → strip → assert the snapshot carries NO secret.
    const envelope = await exportBackup(prisma);
    const stripped = stripSecrets(envelope);
    const snapshotJson = JSON.stringify(stripped);
    expect(snapshotJson).not.toContain("ENCRYPTED-KEY-BLOB");
    expect(snapshotJson).not.toContain("supa-user-abc");
    expect(stripped.data.AIModelConfig[0].apiKey).toBeNull();

    // Encrypt → decrypt → validate (what push/pull do around the network).
    const blob = encryptSnapshot(snapshotJson, passphrase);
    const decrypted = decryptSnapshot(blob, passphrase);
    const parsed = backupEnvelopeSchema.safeParse(JSON.parse(decrypted));
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    // Simulate a "new machine": wipe the secret locally differently, then import the snapshot.
    await prisma.aIModelConfig.updateMany({ data: { apiKey: "LOCAL-DIFFERENT" } });

    await importBackup(prisma, parsed.data);

    // Non-secret data intact.
    const profile = await prisma.userProfile.findUniqueOrThrow({ where: { id: "local" } });
    expect(profile.name).toBe("Khang Guru");

    // Secret field came back NULL from the snapshot (must be re-entered on the new machine).
    const cfg = await prisma.aIModelConfig.findFirstOrThrow();
    expect(cfg.apiKey).toBeNull();
    // Binding not clobbered by the snapshot (supabaseUserId was stripped → null in snapshot).
    const state = await prisma.appState.findUniqueOrThrow({ where: { id: "singleton" } });
    expect(state.supabaseUserId).toBeNull();
  });
});
