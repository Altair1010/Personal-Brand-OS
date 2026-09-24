import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";

const json = (value: unknown) => value as Prisma.InputJsonValue;
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : value == null ? [] : [value];
const text = (value: unknown, fallback = "") => typeof value === "string" && value.trim() ? value.trim() : fallback;

export type IMCPlanInput = {
  strategyVersionId: string;
  objective: string;
  audienceSegments: unknown[];
  strategicThesis: string;
  keyMessage: string;
  creativePlatform: unknown;
  funnelStages: unknown[];
  channelPlans: unknown[];
  campaigns: unknown[];
  contentRequirements: unknown[];
  budgetAllocation?: unknown;
  kpis: unknown[];
  experiments?: unknown[];
  measurementPlan: unknown;
  assumptions?: unknown[];
  risks?: unknown[];
};

export async function createImcPlanVersion(db: PrismaClient, input: IMCPlanInput) {
  const tenant = await resolveLocalTenant(db);
  const strategy = await db.strategyVersion.findUnique({
    where: { id: input.strategyVersionId },
    include: { strategy: true },
  });
  if (!strategy) throw new Error("STRATEGY_VERSION_NOT_FOUND");
  if (strategy.strategy.organizationId !== tenant.organizationId || strategy.strategy.brandId !== tenant.brandId) {
    throw new Error("TENANT_ANCESTRY_MISMATCH");
  }
  const latest = await db.iMCPlan.findFirst({
    where: { strategyVersionId: input.strategyVersionId },
    orderBy: { version: "desc" },
  });
  return db.iMCPlan.create({
    data: {
      id: randomUUID(),
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      brandId: tenant.brandId,
      strategyVersionId: input.strategyVersionId,
      version: (latest?.version ?? 0) + 1,
      objective: input.objective,
      audienceSegments: json(input.audienceSegments),
      strategicThesis: input.strategicThesis,
      keyMessage: input.keyMessage,
      creativePlatform: json(input.creativePlatform),
      funnelStages: json(input.funnelStages),
      channelPlans: json(input.channelPlans),
      campaigns: json(input.campaigns),
      contentRequirements: json(input.contentRequirements),
      budgetAllocation: input.budgetAllocation === undefined ? undefined : json(input.budgetAllocation),
      kpis: json(input.kpis),
      experiments: input.experiments === undefined ? undefined : json(input.experiments),
      measurementPlan: json(input.measurementPlan),
      assumptions: input.assumptions === undefined ? undefined : json(input.assumptions),
      risks: input.risks === undefined ? undefined : json(input.risks),
      status: "DRAFT",
    },
  });
}

/**
 * Deterministically projects a canonical MarketingStrategy into an IMC draft.
 * No LLM regeneration: the structured StrategyVersion remains the source of truth.
 */
export async function ensureImcPlanFromStrategy(db: PrismaClient, strategyVersionId: string) {
  const existing = await db.iMCPlan.findFirst({
    where: { strategyVersionId },
    orderBy: { version: "desc" },
  });
  if (existing) return existing;

  const version = await db.strategyVersion.findUnique({
    where: { id: strategyVersionId },
    include: {
      strategy: {
        include: { goal: true },
      },
    },
  });
  if (!version) throw new Error("STRATEGY_VERSION_NOT_FOUND");

  const structured = record(version.structuredPlan);
  if (Object.keys(structured).length === 0) throw new Error("STRUCTURED_STRATEGY_REQUIRED");

  const positioning = record(structured.positioning);
  const objectives = array(structured.objectives);
  const channels = array(structured.channels);
  const kpis = array(structured.kpis);
  const thesis = text(
    structured.strategicThesis,
    `Execute ${version.strategy.goal.name} through a coordinated 30-day plan.`,
  );
  const keyMessage = text(
    positioning.proposition,
    text(positioning.statement, thesis),
  );

  const channelPlans = channels.map((channel) =>
    typeof channel === "string"
      ? { channel, role: "TBD", objective: version.strategy.goal.goalType }
      : channel,
  );

  return createImcPlanVersion(db, {
    strategyVersionId,
    objective: version.strategy.goal.goalType,
    audienceSegments: array(structured.audiences),
    strategicThesis: thesis,
    keyMessage,
    creativePlatform: {
      source: "structured-strategy-projection",
      positioning,
      thesis,
    },
    funnelStages: array(structured.funnel),
    channelPlans,
    campaigns: [],
    contentRequirements: array(structured.contentPillars),
    kpis,
    experiments: array(structured.experiments),
    measurementPlan: {
      source: "strategy-kpis",
      objectives,
      kpis,
      note: "Draft measurement plan; campaign-specific targets remain explicit execution inputs.",
    },
    assumptions: array(structured.assumptions),
    risks: array(structured.risks),
  });
}
