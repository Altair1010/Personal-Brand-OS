import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { runP2Backfill } from "@/lib/piltover/modules/platform/infrastructure/p2-backfill";
import {
  createDisposableP2Database,
  type DisposableP2Database,
} from "@/tests/piltover/p2-test-db";

type AttackCase = {
  readonly name: string;
  readonly code?: string;
  readonly family: string;
  readonly childTable: string;
  readonly relationField: string;
  readonly childId: string;
  readonly foreignId: string;
  inject(db: PrismaClient): Promise<void>;
};

async function seedTwoOwnerLegacyGraph(db: PrismaClient): Promise<void> {
  await db.userProfile.createMany({
    data: [
      { id: "owner-a", name: "Owner A" },
      { id: "owner-b", name: "Owner B" },
    ],
  });
  await db.goal.createMany({
    data: [
      { id: "goal-a", userId: "owner-a", name: "Goal A", goalType: "growth" },
      { id: "goal-b", userId: "owner-b", name: "Goal B", goalType: "growth" },
    ],
  });
  await db.contentPillar.createMany({
    data: [
      { id: "pillar-a", userId: "owner-a", goalId: "goal-a", name: "Pillar A" },
      { id: "pillar-b", userId: "owner-b", goalId: "goal-b", name: "Pillar B" },
    ],
  });
  await db.strategy.createMany({
    data: [
      { id: "strategy-a", userId: "owner-a", goalId: "goal-a", name: "Strategy A" },
      { id: "strategy-b", userId: "owner-b", goalId: "goal-b", name: "Strategy B" },
    ],
  });
  await db.strategyVersion.createMany({
    data: [
      { id: "version-a", strategyId: "strategy-a", version: 1, reason: "fixture" },
      { id: "version-b", strategyId: "strategy-b", version: 1, reason: "fixture" },
    ],
  });
  await db.weeklyPlan.createMany({
    data: [
      { id: "week-a", strategyVersionId: "version-a", weekIndex: 1 },
      { id: "week-b", strategyVersionId: "version-b", weekIndex: 1 },
    ],
  });
  await db.dailyPlan.createMany({
    data: [
      { id: "day-a", weeklyPlanId: "week-a", dayIndex: 1, plannedPillarId: "pillar-a" },
      { id: "day-b", weeklyPlanId: "week-b", dayIndex: 1, plannedPillarId: "pillar-b" },
    ],
  });
  await db.contentIdea.createMany({
    data: [
      { id: "idea-a", userId: "owner-a", dailyPlanId: "day-a", pillarId: "pillar-a", title: "Idea A" },
      { id: "idea-b", userId: "owner-b", dailyPlanId: "day-b", pillarId: "pillar-b", title: "Idea B" },
    ],
  });
  await db.contentDraft.createMany({
    data: [
      { id: "draft-a", userId: "owner-a", contentIdeaId: "idea-a", pillarId: "pillar-a" },
      { id: "draft-b", userId: "owner-b", contentIdeaId: "idea-b", pillarId: "pillar-b" },
    ],
  });
  await db.facebookAccount.create({
    data: {
      id: "facebook-b",
      ownerRef: "owner-b",
      pageId: "page-b",
      pageName: "Page B",
      accessToken: "encrypted-fixture",
    },
  });
  await db.framework.create({
    data: { id: "framework-b", userId: "owner-b", slug: "framework-b", name: "Framework B" },
  });
}

async function canonicalCounts(db: PrismaClient): Promise<readonly number[]> {
  return Promise.all([
    db.userIdentity.count(),
    db.organization.count(),
    db.workspace.count(),
    db.brand.count(),
    db.membership.count(),
  ]);
}

const attacks: readonly AttackCase[] = [
  {
    name: "AudienceSegment(A) -> Goal(B)",
    family: "AUDIENCE_SEGMENT_GOAL",
    childTable: "AudienceSegment",
    relationField: "goalId",
    childId: "attack-segment",
    foreignId: "goal-b",
    inject: async (db) => { await db.audienceSegment.create({ data: { id: "attack-segment", userId: "owner-a", goalId: "goal-b", name: "Attack" } }); },
  },
  {
    name: "ContentPillar(A) -> Goal(B)",
    family: "CONTENT_PILLAR_GOAL",
    childTable: "ContentPillar",
    relationField: "goalId",
    childId: "attack-pillar-goal",
    foreignId: "goal-b",
    inject: async (db) => { await db.contentPillar.create({ data: { id: "attack-pillar-goal", userId: "owner-a", goalId: "goal-b", name: "Attack" } }); },
  },
  {
    name: "Strategy(A) -> Goal(B)",
    family: "STRATEGY_GOAL",
    childTable: "Strategy",
    relationField: "goalId",
    childId: "attack-strategy-goal",
    foreignId: "goal-b",
    inject: async (db) => { await db.strategy.create({ data: { id: "attack-strategy-goal", userId: "owner-a", goalId: "goal-b", name: "Attack" } }); },
  },
  {
    name: "ContentIdea(A) -> DailyPlan(B)",
    family: "CONTENT_IDEA_DAILY_PLAN",
    childTable: "ContentIdea",
    relationField: "dailyPlanId",
    childId: "attack-idea-day",
    foreignId: "day-b",
    inject: async (db) => { await db.contentIdea.create({ data: { id: "attack-idea-day", userId: "owner-a", dailyPlanId: "day-b", title: "Attack" } }); },
  },
  {
    name: "ContentIdea(A) -> ContentPillar(B)",
    family: "CONTENT_IDEA_PILLAR",
    childTable: "ContentIdea",
    relationField: "pillarId",
    childId: "attack-idea-pillar",
    foreignId: "pillar-b",
    inject: async (db) => { await db.contentIdea.create({ data: { id: "attack-idea-pillar", userId: "owner-a", pillarId: "pillar-b", title: "Attack" } }); },
  },
  {
    name: "DailyPlan(A-derived) -> ContentPillar(B)",
    family: "DAILY_PLAN_PILLAR",
    childTable: "DailyPlan",
    relationField: "plannedPillarId",
    childId: "attack-day-pillar",
    foreignId: "pillar-b",
    inject: async (db) => { await db.dailyPlan.create({ data: { id: "attack-day-pillar", weeklyPlanId: "week-a", dayIndex: 2, plannedPillarId: "pillar-b" } }); },
  },
  {
    name: "WeeklyPlan(A-derived) -> semantic ContentPillar(B)",
    family: "WEEKLY_PLAN_FOCUS_PILLAR",
    childTable: "WeeklyPlan",
    relationField: "focusPillarId",
    childId: "week-a",
    foreignId: "pillar-b",
    inject: async (db) => { await db.weeklyPlan.update({ where: { id: "week-a" }, data: { focusPillarId: "pillar-b" } }); },
  },
  {
    name: "WeeklyPlan -> missing semantic ContentPillar",
    code: "MIGRATION_UNRESOLVED_RELATION",
    family: "WEEKLY_PLAN_FOCUS_PILLAR",
    childTable: "WeeklyPlan",
    relationField: "focusPillarId",
    childId: "week-a",
    foreignId: "missing-pillar",
    inject: async (db) => { await db.weeklyPlan.update({ where: { id: "week-a" }, data: { focusPillarId: "missing-pillar" } }); },
  },
  {
    name: "ContentDraft(A) -> ContentIdea(B)",
    family: "CONTENT_DRAFT_IDEA",
    childTable: "ContentDraft",
    relationField: "contentIdeaId",
    childId: "attack-draft-idea",
    foreignId: "idea-b",
    inject: async (db) => { await db.contentDraft.create({ data: { id: "attack-draft-idea", userId: "owner-a", contentIdeaId: "idea-b" } }); },
  },
  {
    name: "ContentDraft(A) -> ContentPillar(B)",
    family: "CONTENT_DRAFT_PILLAR",
    childTable: "ContentDraft",
    relationField: "pillarId",
    childId: "attack-draft-pillar",
    foreignId: "pillar-b",
    inject: async (db) => { await db.contentDraft.create({ data: { id: "attack-draft-pillar", userId: "owner-a", pillarId: "pillar-b" } }); },
  },
  {
    name: "Post(A) -> ContentDraft(B)",
    family: "POST_DRAFT",
    childTable: "Post",
    relationField: "contentDraftId",
    childId: "attack-post-draft",
    foreignId: "draft-b",
    inject: async (db) => { await db.post.create({ data: { id: "attack-post-draft", userId: "owner-a", contentDraftId: "draft-b" } }); },
  },
  {
    name: "Post(A) -> ContentPillar(B)",
    family: "POST_PILLAR",
    childTable: "Post",
    relationField: "pillarId",
    childId: "attack-post-pillar",
    foreignId: "pillar-b",
    inject: async (db) => {
      await db.contentDraft.create({ data: { id: "attack-post-pillar-draft", userId: "owner-a" } });
      await db.post.create({ data: { id: "attack-post-pillar", userId: "owner-a", contentDraftId: "attack-post-pillar-draft", pillarId: "pillar-b" } });
    },
  },
  {
    name: "Post(A) -> StrategyVersion(B)",
    family: "POST_STRATEGY_VERSION",
    childTable: "Post",
    relationField: "strategyVersionId",
    childId: "attack-post-version",
    foreignId: "version-b",
    inject: async (db) => {
      await db.contentDraft.create({ data: { id: "attack-post-version-draft", userId: "owner-a" } });
      await db.post.create({ data: { id: "attack-post-version", userId: "owner-a", contentDraftId: "attack-post-version-draft", strategyVersionId: "version-b" } });
    },
  },
  {
    name: "Post(A) -> DailyPlan(B)",
    family: "POST_DAILY_PLAN",
    childTable: "Post",
    relationField: "dailyPlanId",
    childId: "attack-post-day",
    foreignId: "day-b",
    inject: async (db) => {
      await db.contentDraft.create({ data: { id: "attack-post-day-draft", userId: "owner-a" } });
      await db.post.create({ data: { id: "attack-post-day", userId: "owner-a", contentDraftId: "attack-post-day-draft", dailyPlanId: "day-b" } });
    },
  },
  {
    name: "Post(A) -> FacebookAccount(B)",
    family: "POST_FACEBOOK_ACCOUNT",
    childTable: "Post",
    relationField: "facebookAccountId",
    childId: "attack-post-facebook",
    foreignId: "facebook-b",
    inject: async (db) => {
      await db.contentDraft.create({ data: { id: "attack-post-facebook-draft", userId: "owner-a" } });
      await db.post.create({ data: { id: "attack-post-facebook", userId: "owner-a", contentDraftId: "attack-post-facebook-draft", facebookAccountId: "facebook-b" } });
    },
  },
  {
    name: "Strategy(A) -> tenant Framework(B)",
    family: "STRATEGY_FRAMEWORK",
    childTable: "Strategy",
    relationField: "frameworkSlug",
    childId: "strategy-a",
    foreignId: "framework-b",
    inject: async (db) => { await db.strategy.update({ where: { id: "strategy-a" }, data: { frameworkSlug: "framework-b" } }); },
  },
];

describe("P2 legacy relation-graph preflight", () => {
  it.each(attacks)("rejects $name before canonical tenant writes", async (attack) => {
    let database: DisposableP2Database | undefined;
    try {
      database = await createDisposableP2Database();
      const db = database.client;
      await seedTwoOwnerLegacyGraph(db);
      await attack.inject(db);
      const before = await canonicalCounts(db);

      await expect(runP2Backfill(db)).rejects.toThrow(
        `${attack.code ?? "MIGRATION_CROSS_TENANT_RELATION"}:${attack.family}:${attack.childId}`,
      );

      expect(await canonicalCounts(db)).toEqual(before);
      expect(before).toEqual([0, 0, 0, 0, 0]);
      const relation = await db.$queryRawUnsafe<Array<{ ref: string }>>(
        `SELECT "${attack.relationField}" AS ref FROM "${attack.childTable}" WHERE id = ?`,
        attack.childId,
      );
      expect(relation).toEqual([{ ref: attack.foreignId }]);
    } finally {
      await database?.dispose();
    }
  }, 120_000);

  it("allows a genuinely global Framework parent", async () => {
    const database = await createDisposableP2Database();
    try {
      const db = database.client;
      await seedTwoOwnerLegacyGraph(db);
      await db.framework.create({ data: { id: "framework-global", slug: "framework-global", name: "Global" } });
      await db.strategy.update({ where: { id: "strategy-a" }, data: { frameworkSlug: "framework-global" } });

      await expect(runP2Backfill(db)).resolves.toMatchObject({ profilesProcessed: 2 });
      expect(await db.framework.findUniqueOrThrow({ where: { id: "framework-global" }, select: { userId: true, organizationId: true, brandId: true } }))
        .toEqual({ userId: null, organizationId: null, brandId: null });
    } finally {
      await database.dispose();
    }
  }, 120_000);
});

async function seedDirectRows(db: PrismaClient): Promise<void> {
  await db.userProfile.createMany({
    data: [
      { id: "owner-a", name: "Owner A" },
      { id: "owner-b", name: "Owner B" },
    ],
  });
  await db.goal.createMany({
    data: [
      { id: "goal-a", userId: "owner-a", name: "Goal A", goalType: "growth" },
      { id: "goal-b", userId: "owner-b", name: "Goal B", goalType: "growth" },
    ],
  });
}

describe("P2 transitional scope preflight", () => {
  it("rejects a pre-scoped PromptRun with no ownership evidence", async () => {
    const database = await createDisposableP2Database();
    try {
      const db = database.client;
      await seedDirectRows(db);
      await runP2Backfill(db);
      const ownerB = await db.userProfile.findUniqueOrThrow({
        where: { id: "owner-b" },
        include: { identity: { include: { memberships: { include: { organization: { include: { brands: true } } } } } } },
      });
      const organization = ownerB.identity!.memberships[0].organization;
      await db.promptRun.create({
        data: { id: "run-no-evidence", moduleKey: "fixture", provider: "fixture", model: "fixture", organizationId: organization.id, brandId: organization.brands[0].id },
      });

      await expect(runP2Backfill(db)).rejects.toThrow(
        "MIGRATION_SCOPE_MISMATCH:PROMPT_RUN:run-no-evidence",
      );
    } finally {
      await database.dispose();
    }
  }, 120_000);

  it("rejects a PromptRun scoped to a tenant other than its consumer before scoping that consumer", async () => {
    const database = await createDisposableP2Database();
    try {
      const db = database.client;
      await seedDirectRows(db);
      await runP2Backfill(db);
      const ownerB = await db.userProfile.findUniqueOrThrow({
        where: { id: "owner-b" },
        include: { identity: { include: { memberships: { include: { organization: { include: { brands: true } } } } } } },
      });
      const organization = ownerB.identity!.memberships[0].organization;
      await db.promptRun.create({
        data: { id: "run-wrong-tenant", moduleKey: "fixture", provider: "fixture", model: "fixture", organizationId: organization.id, brandId: organization.brands[0].id },
      });
      await db.contentDraft.create({ data: { id: "draft-run-owner-a", userId: "owner-a", aiPromptRunId: "run-wrong-tenant" } });

      await expect(runP2Backfill(db)).rejects.toThrow(
        "MIGRATION_SCOPE_MISMATCH:PROMPT_RUN:run-wrong-tenant",
      );
      expect(await db.contentDraft.findUniqueOrThrow({ where: { id: "draft-run-owner-a" }, select: { organizationId: true, brandId: true } }))
        .toEqual({ organizationId: null, brandId: null });
    } finally {
      await database.dispose();
    }
  }, 120_000);

  it("checks the complete direct-scope family with one fail-closed rule", async () => {
    const database = await createDisposableP2Database();
    try {
      const db = database.client;
      await seedTwoOwnerLegacyGraph(db);
      await db.brandDNA.create({ data: { id: "dna-a", userId: "owner-a" } });
      await db.audienceSegment.create({ data: { id: "segment-a", userId: "owner-a", goalId: "goal-a", name: "Segment A" } });
      await db.post.create({ data: { id: "post-a", userId: "owner-a", contentDraftId: "draft-a", strategyVersionId: "version-a", dailyPlanId: "day-a", pillarId: "pillar-a" } });
      await db.performanceInsight.create({ data: { id: "insight-a", userId: "owner-a", scope: "post", finding: "Fixture" } });
      await db.exportHistory.create({ data: { id: "export-a", userId: "owner-a", kind: "backup", filename: "fixture.zip" } });
      await db.contentObjective.create({ data: { id: "objective-educate", key: "educate", label: "Educate" } });
      await db.contentTemplate.create({ data: { id: "template-a", userId: "owner-a", name: "Template A", objectiveKey: "educate", structure: {} } });
      await db.framework.create({ data: { id: "framework-a", userId: "owner-a", slug: "framework-a", name: "Framework A" } });
      await db.facebookAccount.create({ data: { id: "facebook-a", ownerRef: "owner-a", pageId: "page-a", pageName: "Page A", accessToken: "encrypted-fixture" } });
      await runP2Backfill(db);
      const profiles = await db.userProfile.findMany({
        include: { identity: { include: { memberships: { include: { organization: { include: { brands: true } } } } } } },
      });
      const tenant = (ownerId: string) => {
        const profile = profiles.find((candidate) => candidate.id === ownerId)!;
        const organization = profile.identity!.memberships[0].organization;
        return { organizationId: organization.id, brandId: organization.brands[0].id };
      };
      const ownerA = tenant("owner-a");
      const ownerB = tenant("owner-b");
      const cases = [
        ["BrandDNA", "BRAND_DNA", "dna-a"],
        ["Goal", "GOAL", "goal-a"],
        ["AudienceSegment", "AUDIENCE_SEGMENT", "segment-a"],
        ["ContentPillar", "CONTENT_PILLAR", "pillar-a"],
        ["Strategy", "STRATEGY", "strategy-a"],
        ["ContentIdea", "CONTENT_IDEA", "idea-a"],
        ["ContentDraft", "CONTENT_DRAFT", "draft-a"],
        ["Post", "POST", "post-a"],
        ["PerformanceInsight", "PERFORMANCE_INSIGHT", "insight-a"],
        ["ExportHistory", "EXPORT_HISTORY", "export-a"],
        ["ContentTemplate", "CONTENT_TEMPLATE", "template-a"],
        ["Framework", "FRAMEWORK", "framework-a"],
        ["FacebookAccount", "FACEBOOK_ACCOUNT", "facebook-a"],
      ] as const;

      for (const [table, family, id] of cases) {
        await db.$executeRawUnsafe(`UPDATE "${table}" SET organizationId = ?, brandId = ? WHERE id = ?`, ownerB.organizationId, ownerB.brandId, id);
        await expect(runP2Backfill(db)).rejects.toThrow(`MIGRATION_SCOPE_MISMATCH:${family}:${id}`);
        await db.$executeRawUnsafe(`UPDATE "${table}" SET organizationId = ?, brandId = ? WHERE id = ?`, ownerA.organizationId, ownerA.brandId, id);
      }
    } finally {
      await database.dispose();
    }
  }, 120_000);

  it("rejects a complete foreign scope pair without normalizing it", async () => {
    const database = await createDisposableP2Database();
    try {
      const db = database.client;
      await seedDirectRows(db);
      await runP2Backfill(db);
      const profileB = await db.userProfile.findUniqueOrThrow({
        where: { id: "owner-b" },
        include: { identity: { include: { memberships: { include: { organization: { include: { brands: true } } } } } } },
      });
      const brandB = profileB.identity!.memberships[0].organization.brands[0];
      await db.goal.update({ where: { id: "goal-a" }, data: { organizationId: brandB.organizationId, brandId: brandB.id } });

      await expect(runP2Backfill(db)).rejects.toThrow("MIGRATION_SCOPE_MISMATCH:GOAL:goal-a");
      expect(await db.goal.findUniqueOrThrow({ where: { id: "goal-a" }, select: { organizationId: true, brandId: true } }))
        .toEqual({ organizationId: brandB.organizationId, brandId: brandB.id });
    } finally {
      await database.dispose();
    }
  }, 120_000);

  it.each([
    { name: "organization only", organization: true, brand: false },
    { name: "brand only", organization: false, brand: true },
  ])("rejects a partial scope pair: $name", async ({ organization, brand }) => {
    const database = await createDisposableP2Database();
    try {
      const db = database.client;
      await seedDirectRows(db);
      await runP2Backfill(db);
      const goal = await db.goal.findUniqueOrThrow({ where: { id: "goal-a" } });
      await db.$executeRawUnsafe(
        `UPDATE Goal SET organizationId = ?, brandId = ? WHERE id = 'goal-a'`,
        organization ? goal.organizationId : null,
        brand ? goal.brandId : null,
      );

      await expect(runP2Backfill(db)).rejects.toThrow("MIGRATION_PARTIAL_SCOPE:GOAL:goal-a");
    } finally {
      await database.dispose();
    }
  }, 120_000);

  it("rejects scoped legacy rows when the owning profile has no identity", async () => {
    const database = await createDisposableP2Database();
    try {
      const db = database.client;
      await db.userProfile.create({ data: { id: "owner-a", name: "Owner A" } });
      await db.organization.create({ data: { id: "existing-org", name: "Existing" } });
      await db.workspace.create({ data: { id: "existing-workspace", organizationId: "existing-org", name: "Existing" } });
      await db.brand.create({ data: { id: "existing-brand", organizationId: "existing-org", workspaceId: "existing-workspace", name: "Existing" } });
      await db.goal.create({ data: { id: "goal-a", userId: "owner-a", name: "Goal A", goalType: "growth", organizationId: "existing-org", brandId: "existing-brand" } });
      const before = await canonicalCounts(db);

      await expect(runP2Backfill(db)).rejects.toThrow("PARTIAL_MIGRATION_CONFLICT:GOAL:goal-a");
      expect(await canonicalCounts(db)).toEqual(before);
      expect(await db.userProfile.findUniqueOrThrow({ where: { id: "owner-a" }, select: { userIdentityId: true } }))
        .toEqual({ userIdentityId: null });
    } finally {
      await database.dispose();
    }
  }, 120_000);

  it("preserves a correct pre-scoped pair without touching the row", async () => {
    const database = await createDisposableP2Database();
    try {
      const db = database.client;
      await seedDirectRows(db);
      await runP2Backfill(db);
      const fixedTimestamp = "2000-01-01T00:00:00.000Z";
      await db.$executeRawUnsafe(`UPDATE Goal SET updatedAt = ? WHERE id = 'goal-a'`, fixedTimestamp);

      const second = await runP2Backfill(db);

      expect(second.created).toMatchObject({ userIdentities: 0, organizations: 0, workspaces: 0, brands: 0, memberships: 0 });
      expect((await db.goal.findUniqueOrThrow({ where: { id: "goal-a" } })).updatedAt.toISOString())
        .toBe(fixedTimestamp);
    } finally {
      await database.dispose();
    }
  }, 120_000);

  it("rejects a cross-tenant MetricObservation legacy Post on retry", async () => {
    const database = await createDisposableP2Database();
    try {
      const db = database.client;
      await seedTwoOwnerLegacyGraph(db);
      await db.post.createMany({
        data: [
          { id: "post-a", userId: "owner-a", contentDraftId: "draft-a" },
          { id: "post-b", userId: "owner-b", contentDraftId: "draft-b" },
        ],
      });
      await runP2Backfill(db);
      const postA = await db.post.findUniqueOrThrow({ where: { id: "post-a" } });
      await db.metricObservation.create({
        data: {
          id: "observation-cross",
          organizationId: postA.organizationId!,
          brandId: postA.brandId!,
          legacyPostId: "post-b",
          metricKey: "reach",
          valueKind: "NUMERIC",
          numericValue: 1,
          observedAt: new Date("2026-09-06T00:00:00.000Z"),
          source: "fixture",
          sourceRecordId: "fixture",
          dedupeKey: "cross-tenant-fixture",
        },
      });

      await expect(runP2Backfill(db)).rejects.toThrow(
        "MIGRATION_CROSS_TENANT_RELATION:METRIC_OBSERVATION_POST:observation-cross",
      );
      expect((await db.metricObservation.findUniqueOrThrow({ where: { id: "observation-cross" } })).legacyPostId)
        .toBe("post-b");
    } finally {
      await database.dispose();
    }
  }, 120_000);
});
