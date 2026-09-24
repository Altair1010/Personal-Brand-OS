import type { Prisma, PrismaClient } from "@prisma/client";

const json = (value: unknown) => value as Prisma.InputJsonValue;
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export type StructuredStrategy = {
  diagnosis: unknown;
  marketContext: unknown;
  audiences: unknown[];
  positioning: unknown;
  strategicThesis: string;
  objectives: unknown[];
  funnel: unknown;
  channels: unknown[];
  contentPillars: unknown[];
  kpis: unknown[];
  assumptions: unknown[];
  risks: unknown[];
  experiments: unknown[];
};

export async function saveStructuredStrategy(
  db: PrismaClient,
  strategyVersionId: string,
  structured: StructuredStrategy,
) {
  const version = await db.strategyVersion.findUnique({
    where: { id: strategyVersionId },
    include: { strategy: true },
  });
  if (!version) throw new Error("STRATEGY_VERSION_NOT_FOUND");
  const payload = {
    schemaVersion: "piltover.marketing-strategy/v1",
    ...structured,
  };
  return db.strategyVersion.update({
    where: { id: strategyVersionId },
    data: { structuredPlan: json(payload) },
  });
}

/**
 * Converts a legacy 30-day StrategyVersion into the canonical MarketingStrategy schema.
 * This is deterministic migration logic: no LLM is invoked and no historical fields are overwritten.
 */
export async function ensureStructuredStrategyProjection(
  db: PrismaClient,
  strategyVersionId: string,
) {
  const version = await db.strategyVersion.findUnique({
    where: { id: strategyVersionId },
    include: {
      strategy: {
        include: { goal: true },
      },
      weeklyPlans: {
        orderBy: { weekIndex: "asc" },
        include: { dailyPlans: { orderBy: { dayIndex: "asc" } } },
      },
    },
  });
  if (!version) throw new Error("STRATEGY_VERSION_NOT_FOUND");
  if (version.structuredPlan && Object.keys(record(version.structuredPlan)).length > 0) return version;

  const [brandDna, audiences, pillars] = await Promise.all([
    db.brandDNA.findFirst({
      where: {
        organizationId: version.strategy.organizationId,
        brandId: version.strategy.brandId,
      },
    }),
    db.audienceSegment.findMany({
      where: {
        organizationId: version.strategy.organizationId,
        brandId: version.strategy.brandId,
        goalId: version.strategy.goalId,
        source: { not: "archived" },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.contentPillar.findMany({
      where: {
        organizationId: version.strategy.organizationId,
        brandId: version.strategy.brandId,
        goalId: version.strategy.goalId,
        status: "active",
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const weeklyThemes = array(version.weeklyThemes);
  const themeNames = weeklyThemes
    .map((item) => record(item).theme)
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0);

  const contentRatio = record(version.contentRatio);
  const structured: StructuredStrategy = {
    diagnosis: {
      assumptions: array(version.assumptions),
      guardrails: array(version.doNotList),
    },
    marketContext: {
      timeframeDays: version.strategy.timeframeDays,
      frameworkSlug: version.strategy.frameworkSlug,
      source: "legacy-strategy-projection",
      strategyVersion: version.version,
    },
    audiences: audiences.map((item) => ({
      id: item.id,
      segment: item.name,
      pains: [item.pain, item.falseBelief, item.fear].filter(Boolean),
      motivations: [item.desire].filter(Boolean),
      language: item.language,
      offer: item.offer,
    })),
    positioning: {
      statement: brandDna?.aiPositioning ?? brandDna?.differentiation ?? null,
      proposition: brandDna?.usp ?? null,
      brand: brandDna?.companyName ?? brandDna?.whoAmI ?? null,
      field: brandDna?.field ?? null,
    },
    strategicThesis:
      themeNames.join(" → ") ||
      `Execute a ${version.strategy.timeframeDays}-day strategy for ${version.strategy.goal.name}.`,
    objectives: [{
      key: version.strategy.goal.goalType,
      name: version.strategy.goal.name,
      targetAudience: version.strategy.goal.targetAudience,
      offer: version.strategy.goal.mainOffer,
      contentRatio,
    }],
    funnel: {
      ctaPlan: array(version.ctaPlan),
    },
    channels: [],
    contentPillars: pillars.length
      ? pillars.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          ratioPercent: item.ratioPercent,
          objectiveMix: item.objectiveMix,
        }))
      : array(version.topicMap),
    kpis: array(version.kpiToTrack).map((item) =>
      typeof item === "string" ? { key: item } : item,
    ),
    assumptions: array(version.assumptions),
    risks: array(version.doNotList).map((description) => ({
      type: "guardrail",
      description,
    })),
    experiments: [],
  };

  return saveStructuredStrategy(db, version.id, structured);
}
