import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import { runP2Backfill } from "@/lib/piltover/modules/platform/infrastructure/p2-backfill";
import { createMigrationWorkspace, deployMigrations } from "@/tests/piltover/p2-test-db";

let client: PrismaClient | undefined;
let tempRoot: string | undefined;

afterEach(async () => {
  await client?.$disconnect();
  client = undefined;
  if (tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true });
  tempRoot = undefined;
});

describe("P2 forward migration", () => {
  it("migrates populated pre-P2 data without loss and is safe to deploy twice", async () => {
    const workspace = createMigrationWorkspace(false);
    tempRoot = workspace.root;
    deployMigrations(workspace.schemaPath, workspace.url);
    client = new PrismaClient({ datasources: { db: { url: workspace.url } } });
    const now = "2026-09-06T00:00:00.000Z";
    await client.$executeRawUnsafe(`INSERT INTO UserProfile (id,name,locale,createdAt,updatedAt) VALUES ('local','Legacy Owner','vi','${now}','${now}')`);
    await client.$executeRawUnsafe(`INSERT INTO BrandDNA (id,userId,companyName,createdAt,updatedAt) VALUES ('dna-1','local','Legacy Brand','${now}','${now}')`);
    await client.$executeRawUnsafe(`INSERT INTO ContentPillar (id,userId,name,description,createdAt,updatedAt) VALUES ('pillar-1','local','Pillar','Text','${now}','${now}')`);
    await client.$executeRawUnsafe(`INSERT INTO PromptRun (id,moduleKey,provider,model,input,rawOutput,createdAt) VALUES ('run-unowned','legacy','test','test','\"sensitive-input\"','sensitive-output','${now}')`);
    await client.$executeRawUnsafe(`INSERT INTO ContentDraft (id,userId,contentMarkdown,status,createdAt,updatedAt) VALUES ('draft-1','local','Legacy post','draft','${now}','${now}')`);
    await client.$executeRawUnsafe(`INSERT INTO Post (id,contentDraftId,userId,platform,finalText,publishedAt,status,createdAt,updatedAt) VALUES ('post-1','draft-1','local','facebook','Legacy post','${now}','posted','${now}','${now}')`);
    await client.$executeRawUnsafe(`INSERT INTO MetricSnapshot (id,postId,reach,engagement,comments,shares,saves,inboxNote,source,capturedAt) VALUES ('metric-1','post-1',42,NULL,2,NULL,0,'legacy note','manual','${now}')`);
    await client.$disconnect();

    const sourceMigration = path.resolve("prisma/migrations/20260906004200_add_piltover_tenancy_rbac");
    const targetMigration = path.join(path.dirname(workspace.schemaPath), "migrations", path.basename(sourceMigration));
    fs.cpSync(sourceMigration, targetMigration, { recursive: true });
    deployMigrations(workspace.schemaPath, workspace.url);
    deployMigrations(workspace.schemaPath, workspace.url);

    client = new PrismaClient({ datasources: { db: { url: workspace.url } } });
    const first = await runP2Backfill(client);
    const second = await runP2Backfill(client);

    expect(await client.userProfile.findUnique({ where: { id: "local" }, select: { name: true } })).toEqual({ name: "Legacy Owner" });
    expect(await client.brandDNA.findUnique({ where: { id: "dna-1" }, select: { companyName: true, brandId: true } }))
      .toMatchObject({ companyName: "Legacy Brand", brandId: expect.any(String) });
    expect(await client.contentPillar.findUnique({ where: { id: "pillar-1" }, select: { description: true } })).toEqual({ description: "Text" });
    expect(await client.promptRun.findUnique({ where: { id: "run-unowned" }, select: { input: true, rawOutput: true, brandId: true } }))
      .toEqual({ input: "sensitive-input", rawOutput: "sensitive-output", brandId: null });
    expect(await client.metricSnapshot.findUnique({ where: { id: "metric-1" }, select: { reach: true, engagement: true, shares: true, saves: true } }))
      .toEqual({ reach: 42, engagement: null, shares: null, saves: 0 });
    expect(await client.metricObservation.count()).toBe(4);
    expect(first.created.metricObservations).toBe(4);
    expect(second.created).toMatchObject({ userIdentities: 0, organizations: 0, workspaces: 0, brands: 0, memberships: 0, metricObservations: 0 });
    expect(second.promptRuns.legacyUnscoped).toEqual(["run-unowned"]);
    expect(await client.$queryRawUnsafe("PRAGMA foreign_key_check")).toEqual([]);
  }, 120_000);

  it("enforces tenant-pair and typed metric CHECK constraints", async () => {
    const workspace = createMigrationWorkspace();
    tempRoot = workspace.root;
    deployMigrations(workspace.schemaPath, workspace.url);
    client = new PrismaClient({ datasources: { db: { url: workspace.url } } });
    await expect(client.$executeRawUnsafe("INSERT INTO PromptRun (id,moduleKey,provider,model,organizationId) VALUES ('bad','x','x','x','org')"))
      .rejects.toThrow();
    await expect(client.$executeRawUnsafe("INSERT INTO MetricObservation (id,organizationId,brandId,metricKey,valueKind,numericValue,textValue,observedAt,source,sourceRecordId,dedupeKey,createdAt,updatedAt) VALUES ('bad','o','b','x','NUMERIC',1,'also-text',CURRENT_TIMESTAMP,'x','x','x',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
      .rejects.toThrow();

    await client.userIdentity.create({ data: { id: "identity-a" } });
    await client.authIdentity.createMany({
      data: [
        { id: "auth-a", userIdentityId: "identity-a", provider: "supabase", subject: "subject-a" },
        { id: "auth-b", userIdentityId: "identity-a", provider: "supabase", subject: "subject-b" },
      ],
    });
    await expect(client.authIdentity.create({
      data: { id: "auth-c", userIdentityId: "identity-a", provider: "supabase", subject: "subject-a" },
    })).rejects.toThrow();
  }, 120_000);
});
