import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runP2Backfill } from "@/lib/piltover/modules/platform/infrastructure/p2-backfill";
import {
  createDisposableP2Database,
  type DisposableP2Database,
} from "@/tests/piltover/p2-test-db";

let database: DisposableP2Database;

beforeAll(async () => {
  database = await createDisposableP2Database();
}, 120_000);

afterAll(async () => {
  if (database) await database.dispose();
});

async function seedLegacyGraph() {
  const db = database.client;
  await db.appState.create({ data: { id: "singleton", supabaseUserId: "subject-local" } });
  await db.userProfile.createMany({
    data: [
      { id: "local", name: "Local Owner" },
      { id: "other", name: "Other Owner" },
    ],
  });
  await db.brandDNA.createMany({
    data: [
      { id: "dna-local", userId: "local", companyName: "Local Brand" },
      { id: "dna-other", userId: "other", companyName: "Other Brand" },
    ],
  });
  await db.goal.create({
    data: { id: "goal-local", userId: "local", name: "Goal", goalType: "growth" },
  });
  await db.contentPillar.create({
    data: { id: "pillar-local", userId: "local", name: "Pillar" },
  });
  await db.strategy.create({
    data: {
      id: "strategy-local",
      userId: "local",
      goalId: "goal-local",
      name: "Strategy",
    },
  });
  await db.promptRun.createMany({
    data: [
      { id: "run-owned", moduleKey: "strategy", provider: "test", model: "test" },
      { id: "run-unowned", moduleKey: "tone", provider: "test", model: "test" },
      { id: "run-conflict", moduleKey: "draft", provider: "test", model: "test" },
    ],
  });
  await db.strategyVersion.create({
    data: {
      id: "version-local",
      strategyId: "strategy-local",
      version: 1,
      reason: "fixture",
      aiPromptRunId: "run-owned",
    },
  });
  await db.contentDraft.createMany({
    data: [
      { id: "draft-local", userId: "local", aiPromptRunId: "run-owned" },
      { id: "draft-conflict-a", userId: "local", aiPromptRunId: "run-conflict" },
      { id: "draft-conflict-b", userId: "other", aiPromptRunId: "run-conflict" },
    ],
  });
  await db.post.create({
    data: { id: "post-local", contentDraftId: "draft-local", userId: "local" },
  });
  await db.metricSnapshot.create({
    data: {
      id: "metric-local",
      postId: "post-local",
      reach: 12,
      comments: null,
      inboxNote: "qualified lead",
      daysSincePost: 3,
      source: "manual",
    },
  });
  await db.facebookAccount.create({
    data: {
      id: "facebook-local",
      ownerRef: "local",
      pageId: "page-local",
      pageName: "Local Page",
      accessToken: "encrypted-fixture",
    },
  });
}

describe("P2 deterministic legacy backfill", () => {
  it("creates isolated tenant graphs, scopes proven rows, and is idempotent", async () => {
    await seedLegacyGraph();

    const first = await runP2Backfill(database.client);
    const second = await runP2Backfill(database.client);

    expect(first.profilesProcessed).toBe(2);
    expect(second.created).toEqual({
      userIdentities: 0,
      authIdentities: 0,
      organizations: 0,
      workspaces: 0,
      brands: 0,
      memberships: 0,
      metricObservations: 0,
    });

    const profiles = await database.client.userProfile.findMany({
      orderBy: { id: "asc" },
      include: { identity: { include: { memberships: true, authIdentities: true } } },
    });
    expect(profiles[0].identity?.id).not.toBe(profiles[1].identity?.id);
    expect(profiles.find((profile) => profile.id === "local")?.identity?.authIdentities).toHaveLength(1);
    expect(profiles.find((profile) => profile.id === "other")?.identity?.authIdentities).toHaveLength(0);
    expect(profiles.every((profile) => profile.identity?.memberships[0].organizationRole === "OWNER"))
      .toBe(true);

    const localBrand = await database.client.brand.findFirstOrThrow({
      where: { brandDna: { some: { id: "dna-local" } } },
    });
    const ownedRun = await database.client.promptRun.findUniqueOrThrow({ where: { id: "run-owned" } });
    expect([ownedRun.organizationId, ownedRun.brandId]).toEqual([
      localBrand.organizationId,
      localBrand.id,
    ]);
    expect(await database.client.promptRun.findUniqueOrThrow({ where: { id: "run-unowned" } }))
      .toMatchObject({ organizationId: null, brandId: null });
    expect(await database.client.promptRun.findUniqueOrThrow({ where: { id: "run-conflict" } }))
      .toMatchObject({ organizationId: null, brandId: null });
    expect(first.promptRuns).toEqual({ scoped: ["run-owned"], legacyUnscoped: ["run-unowned"], conflicts: ["run-conflict"] });

    const observations = await database.client.metricObservation.findMany({
      orderBy: { metricKey: "asc" },
    });
    expect(observations.map((row) => [row.metricKey, row.numericValue, row.textValue])).toEqual([
      ["inbox_note", null, "qualified lead"],
      ["reach", 12, null],
    ]);
    expect(observations.some((row) => row.metricKey === "comments")).toBe(false);

    const facebook = await database.client.facebookAccount.findUniqueOrThrow({
      where: { id: "facebook-local" },
    });
    expect([facebook.organizationId, facebook.brandId]).toEqual([
      localBrand.organizationId,
      localBrand.id,
    ]);
  }, 120_000);
});
