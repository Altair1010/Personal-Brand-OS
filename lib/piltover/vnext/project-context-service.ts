import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { stableHash } from "@/lib/piltover/shared/contracts/stable-json";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";

type Database = PrismaClient | Prisma.TransactionClient;

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function buildMarketingProjectContext(db: PrismaClient) {
  const tenant = await resolveLocalTenant(db);
  const appState = await db.appState.findUnique({ where: { id: "singleton" } });
  const activeGoalId = appState?.activeGoalId ?? null;

  const [brandDna, goal, audiences, campaigns] = await Promise.all([
    db.brandDNA.findUnique({ where: { userId: "local" } }),
    activeGoalId ? db.goal.findUnique({ where: { id: activeGoalId } }) : Promise.resolve(null),
    activeGoalId
      ? db.audienceSegment.findMany({ where: { goalId: activeGoalId }, orderBy: { createdAt: "asc" } })
      : Promise.resolve([]),
    db.marketingCampaign.findMany({
      where: { brandId: tenant.brandId },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ]);

  return {
    organizationId: tenant.organizationId,
    workspaceId: tenant.workspaceId,
    brandId: tenant.brandId,
    brand: {
      name: brandDna?.companyName ?? null,
      positioning: brandDna?.aiPositioning ?? null,
      proposition: brandDna?.usp ?? null,
      values: brandDna?.coreBeliefs ?? null,
      voice: brandDna?.threeWords ?? [],
      tone: null,
      visualIdentity: null,
      prohibitedClaims: [],
      region: brandDna?.region ?? null,
    },
    offerings: Array.isArray(brandDna?.offers) ? brandDna?.offers : [],
    audiences: audiences.map((item) => ({
      id: item.id,
      segment: item.name,
      jobs: item.contentAngle ? [item.contentAngle] : [],
      pains: item.pain ? [item.pain] : [],
      motivations: item.desire ? [item.desire] : [],
      objections: [item.falseBelief, item.fear].filter(Boolean),
    })),
    competitors: [],
    objectives: goal
      ? [{
          id: goal.id,
          name: goal.name,
          type: goal.goalType,
          kpis: goal.kpi ?? [],
          successDefinition: goal.successDefinition,
        }]
      : [],

    funnel: null,
    channels: ["facebook"],
    campaign: campaigns[0]
      ? {
          id: campaigns[0].id,
          objective: campaigns[0].objective,
          startAt: campaigns[0].startsAt?.toISOString() ?? null,
          endAt: campaigns[0].endsAt?.toISOString() ?? null,
          status: campaigns[0].status,
        }
      : null,
    seo: { domains: [], topics: [], keywords: [] },
    measurement: {
      northStar: goal?.successDefinition ?? null,
      attribution: "last-touch-observed",
    },
  };
}

export async function syncMarketingProjectContext(db: PrismaClient) {
  const context = await buildMarketingProjectContext(db);
  const previous = await db.marketingProjectContext.findFirst({
    where: { brandId: context.brandId, status: "ACTIVE" },
    orderBy: { version: "desc" },
  });
  const currentPayload = {
    brand: context.brand,
    offerings: context.offerings,
    audiences: context.audiences,
    competitors: context.competitors,
    objectives: context.objectives,
    funnel: context.funnel,
    channels: context.channels,
    campaign: context.campaign,
    seo: context.seo,
    measurement: context.measurement,
  };

  if (previous) {
    const previousPayload = {
      brand: previous.brand,
      offerings: previous.offerings,
      audiences: previous.audiences,
      competitors: previous.competitors,
      objectives: previous.objectives,
      funnel: previous.funnel,
      channels: previous.channels,
      campaign: previous.campaign,
      seo: previous.seo,
      measurement: previous.measurement,
    };
    if (stableHash(previousPayload) === stableHash(currentPayload)) return previous;
    await db.marketingProjectContext.update({
      where: { id: previous.id },
      data: { status: "SUPERSEDED" },
    });
  }

  return db.marketingProjectContext.create({
    data: {
      id: randomUUID(),
      organizationId: context.organizationId,
      workspaceId: context.workspaceId,
      brandId: context.brandId,
      version: (previous?.version ?? 0) + 1,
      brand: json(context.brand),
      offerings: json(context.offerings),
      audiences: json(context.audiences),
      competitors: json(context.competitors),
      objectives: json(context.objectives),
      funnel: context.funnel === null ? undefined : json(context.funnel),
      channels: json(context.channels),
      campaign: context.campaign === null ? undefined : json(context.campaign),
      seo: json(context.seo),
      measurement: json(context.measurement),
      status: "ACTIVE",
    },
  });
}
