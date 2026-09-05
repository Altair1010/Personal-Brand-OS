import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  exportBackup,
  importBackup,
  LEGACY_IMPORT_ORDER,
  wipeAll,
  type BackupEnvelope,
} from "@/lib/import-export/backup";
import { runP2Backfill } from "@/lib/piltover/modules/platform/infrastructure/p2-backfill";
import { createDisposableP2Database, type DisposableP2Database } from "@/tests/piltover/p2-test-db";

let database: DisposableP2Database;

beforeEach(async () => {
  database = await createDisposableP2Database();
  await database.client.appState.create({ data: { id: "singleton", supabaseUserId: "subject" } });
  await database.client.userProfile.create({ data: { id: "local", name: "Owner" } });
  await runP2Backfill(database.client);
});

afterEach(async () => database.dispose());

describe("P2 backup envelope", () => {
  it("round-trips the canonical tenant graph as version 2", async () => {
    const before = JSON.parse(JSON.stringify(await exportBackup(database.client))) as BackupEnvelope;
    expect(before.version).toBe(2);
    await wipeAll(database.client);
    await importBackup(database.client, before);
    const after = JSON.parse(JSON.stringify(await exportBackup(database.client))) as BackupEnvelope;
    expect(after.data.UserIdentity).toEqual(before.data.UserIdentity);
    expect(after.data.Organization).toEqual(before.data.Organization);
    expect(after.data.Membership).toEqual(before.data.Membership);
    expect(after.data.Brand).toEqual(before.data.Brand);
  }, 120_000);

  it("upgrades a version-1 legacy envelope through the canonical backfill", async () => {
    const current = await exportBackup(database.client);
    const legacyData = Object.fromEntries(LEGACY_IMPORT_ORDER.map((model) => [
      model,
      (current.data[model] ?? []).map((row) => {
        const legacyRow = { ...row };
        delete legacyRow.userIdentityId;
        delete legacyRow.organizationId;
        delete legacyRow.brandId;
        return legacyRow;
      }),
    ]));
    const legacy = { version: 1, exportedAt: current.exportedAt, data: legacyData } as BackupEnvelope;
    await wipeAll(database.client);
    await importBackup(database.client, legacy);
    expect(await database.client.userIdentity.count()).toBe(1);
    expect(await database.client.organization.count()).toBe(1);
    expect(await database.client.workspace.count()).toBe(1);
    expect(await database.client.brand.count()).toBe(1);
    expect(await database.client.membership.count()).toBe(1);
  }, 120_000);
});
