import type { Prisma, PrismaClient } from "@prisma/client";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";
import {
  MARKETING_CAMPAIGN_STATES,
  assertMarketingCampaignTransition,
  type MarketingCampaignState,
} from "@/lib/piltover/modules/marketing/domain/h1-spine";

const json = (value: unknown) => value as Prisma.InputJsonValue;

export const CAMPAIGN_STATES = MARKETING_CAMPAIGN_STATES;

export async function createExecutionCampaign(db: PrismaClient, input: {
  strategyVersionId: string;
  imcPlanId?: string;
  name: string;
  objective: string;
  audienceIds?: string[];
  channelIds?: string[];
  startsAt?: Date | null;
  endsAt?: Date | null;
  budget?: unknown;
  kpis?: unknown[];
  creativePlatform?: unknown;
  contentPlan?: unknown;
  experimentIds?: string[];
}) {
  const tenant = await resolveLocalTenant(db);
  const strategy = await db.strategyVersion.findUnique({ where: { id: input.strategyVersionId } });
  if (!strategy) throw new Error("STRATEGY_VERSION_NOT_FOUND");
  if (input.imcPlanId) {
    const imc = await db.iMCPlan.findUnique({ where: { id: input.imcPlanId } });
    if (!imc || imc.strategyVersionId !== input.strategyVersionId) throw new Error("IMC_STRATEGY_MISMATCH");
  }
  return db.marketingCampaign.create({
    data: {
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      brandId: tenant.brandId,
      strategyVersionId: input.strategyVersionId,
      imcPlanId: input.imcPlanId ?? null,
      name: input.name,
      objective: input.objective,
      audienceIds: json(input.audienceIds ?? []),
      channelIds: json(input.channelIds ?? []),
      budget: input.budget === undefined ? undefined : json(input.budget),
      kpis: json(input.kpis ?? []),
      creativePlatform: input.creativePlatform === undefined ? undefined : json(input.creativePlatform),
      contentPlan: input.contentPlan === undefined ? undefined : json(input.contentPlan),
      experimentIds: json(input.experimentIds ?? []),
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      status: "DRAFT",
    },
  });
}

export async function transitionExecutionCampaign(
  db: PrismaClient,
  campaignId: string,
  next: MarketingCampaignState,
) {
  const current = await db.marketingCampaign.findUniqueOrThrow({ where: { id: campaignId } });
  if (!MARKETING_CAMPAIGN_STATES.includes(current.status as MarketingCampaignState)) {
    throw new Error(`MARKETING_CAMPAIGN_STATUS_INVALID:${current.status}`);
  }
  assertMarketingCampaignTransition(current.status as MarketingCampaignState, next);
  return db.marketingCampaign.update({ where: { id: campaignId }, data: { status: next } });
}
