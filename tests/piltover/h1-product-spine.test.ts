import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaH1ProductSpine } from "@/lib/piltover/modules/marketing/infrastructure/prisma-h1-product-spine";
import { createDisposableP2Database, type DisposableP2Database } from "./p2-test-db";

describe("H1 product spine", () => {
  let database: DisposableP2Database;
  let spine: PrismaH1ProductSpine;

  beforeAll(async () => {
    database = await createDisposableP2Database();
    const db = database.client;
    await db.userProfile.create({ data: { id: "local", name: "H1 User" } });
    await db.organization.create({ data: { id: "org-h1", name: "H1 Org" } });
    await db.workspace.create({
      data: { id: "wsp-h1", organizationId: "org-h1", name: "H1 Workspace" },
    });
    await db.brand.create({
      data: {
        id: "brand-h1",
        organizationId: "org-h1",
        workspaceId: "wsp-h1",
        name: "H1 Brand",
      },
    });
    await db.brandDNA.create({
      data: {
        userId: "local",
        organizationId: "org-h1",
        brandId: "brand-h1",
        companyName: "H1 Brand",
      },
    });
    const goal = await db.goal.create({
      data: {
        id: "goal-h1",
        userId: "local",
        organizationId: "org-h1",
        brandId: "brand-h1",
        name: "Launch",
        goalType: "growth",
      },
    });
    const strategy = await db.strategy.create({
      data: {
        id: "strategy-h1",
        userId: "local",
        organizationId: "org-h1",
        brandId: "brand-h1",
        goalId: goal.id,
        name: "H1 Strategy",
      },
    });
    const version = await db.strategyVersion.create({
      data: {
        id: "strategy-v1",
        strategyId: strategy.id,
        version: 1,
        reason: "H1 baseline",
      },
    });
    const week = await db.weeklyPlan.create({
      data: { id: "week-h1", strategyVersionId: version.id, weekIndex: 1 },
    });
    const day = await db.dailyPlan.create({
      data: { id: "day-h1", weeklyPlanId: week.id, dayIndex: 1 },
    });
    const idea = await db.contentIdea.create({
      data: {
        id: "idea-h1",
        dailyPlanId: day.id,
        userId: "local",
        organizationId: "org-h1",
        brandId: "brand-h1",
        title: "H1 creative",
      },
    });
    const draft = await db.contentDraft.create({
      data: {
        id: "draft-h1",
        contentIdeaId: idea.id,
        userId: "local",
        organizationId: "org-h1",
        brandId: "brand-h1",
        topic: "H1 creative",
        status: "approved",
      },
    });
    await db.post.create({
      data: {
        id: "post-h1",
        contentDraftId: draft.id,
        userId: "local",
        organizationId: "org-h1",
        brandId: "brand-h1",
        strategyVersionId: version.id,
        dailyPlanId: day.id,
        status: "approved",
      },
    });
    spine = new PrismaH1ProductSpine(db);
  }, 30_000);

  afterAll(async () => database.dispose());
  it("connects strategy, organic delivery, Meta Ads and unified evidence", async () => {
    const campaign = await spine.createCampaign({
      organizationId: "org-h1",
      workspaceId: "wsp-h1",
      brandId: "brand-h1",
      strategyVersionId: "strategy-v1",
      name: "September launch",
      objective: "conversion",
      channelMode: "MIXED",
    });

    const delivery = await spine.scheduleOrganicPost({
      organizationId: "org-h1",
      workspaceId: "wsp-h1",
      brandId: "brand-h1",
      campaignId: campaign.id,
      postId: "post-h1",
      scheduledAt: new Date("2026-09-21T02:00:00Z"),
    });
    expect(delivery.state).toBe("SCHEDULED");

    await spine.transitionDelivery("post-h1", "PUBLISHED", {
      publishedAt: new Date("2026-09-21T02:05:00Z"),
      externalRef: "fb-post-1",
    });
    const post = await database.client.post.findUniqueOrThrow({ where: { id: "post-h1" } });
    expect(post.status).toBe("posted");
    const ads = await spine.createMetaAdsCampaign({
      organizationId: "org-h1",
      workspaceId: "wsp-h1",
      brandId: "brand-h1",
      marketingCampaignId: campaign.id,
      creativePostId: "post-h1",
      name: "Meta conversion test",
      objective: "conversion",
      budgetMinor: 500000,
      targeting: { country: "VN", ageMin: 25, ageMax: 44 },
    });
    await spine.transitionMetaAdsCampaign(ads.id, "EXTERNAL_NOT_CONNECTED");

    await database.client.metricSnapshot.create({
      data: {
        postId: "post-h1",
        reach: 1200,
        engagement: 140,
        comments: 18,
        shares: 6,
        saves: 22,
        source: "manual",
      },
    });
    await spine.recordMetaAdsMetrics({
      metaAdsCampaignId: ads.id,
      capturedAt: new Date("2026-09-22T00:00:00Z"),
      spendMinor: 120000,
      impressions: 5000,
      reach: 4100,
      clicks: 230,
      linkClicks: 180,
      conversions: 12,
      source: "MANUAL",
      evidence: { source: "Meta Ads Manager export", row: 4 },
    });
    const evidence = await spine.getUnifiedPerformanceEvidence("org-h1", "brand-h1");
    expect(evidence).toHaveLength(2);
    expect(evidence.map((row) => row.channel).sort()).toEqual(["ORGANIC", "PAID"]);
    const paid = evidence.find((row) => row.channel === "PAID");
    expect(paid?.metrics.spendMinor).toBe(120000);
    expect(paid?.evidence).toEqual({ source: "Meta Ads Manager export", row: 4 });
  });

  it("fails closed on tenant mismatch and invalid transitions", async () => {
    await expect(
      spine.createCampaign({
        organizationId: "org-h1",
        workspaceId: "wsp-h1",
        brandId: "missing-brand",
        name: "Invalid",
        objective: "reach",
        channelMode: "PAID",
      }),
    ).rejects.toThrow("TENANT_BRAND_NOT_ACTIVE");

    await expect(
      spine.transitionDelivery("post-h1", "APPROVED"),
    ).rejects.toThrow("DELIVERY_TRANSITION_INVALID");

    const ads = await database.client.metaAdsCampaign.findFirstOrThrow();
    await expect(
      spine.transitionMetaAdsCampaign(ads.id, "COMPLETED"),
    ).rejects.toThrow("META_ADS_TRANSITION_INVALID");
  });
});
