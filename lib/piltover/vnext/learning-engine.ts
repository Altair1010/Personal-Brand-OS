import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";
import { captureEvidence } from "@/lib/piltover/vnext/evidence-service";

const json = (value: unknown) => value as Prisma.InputJsonValue;
export const RECOMMENDATION_STATES = ["PROPOSED", "ACCEPTED", "REJECTED", "APPLIED", "ARCHIVED"] as const;

export async function proposeRecommendation(db: PrismaClient, input: {
  type: string;
  title: string;
  rationale: string;
  evidenceRefs?: string[];
}) {
  const tenant = await resolveLocalTenant(db);
  if (!input.title.trim() || !input.rationale.trim()) throw new Error("RECOMMENDATION_CONTENT_REQUIRED");
  return db.recommendation.create({
    data: {
      id: randomUUID(),
      organizationId: tenant.organizationId,
      brandId: tenant.brandId,
      type: input.type,
      title: input.title.trim(),
      rationale: input.rationale.trim(),
      evidenceRefs: json(input.evidenceRefs ?? []),
      status: "PROPOSED",
    },
  });
}

export async function reviewRecommendation(db: PrismaClient, id: string, decision: "ACCEPTED" | "REJECTED") {
  const row = await db.recommendation.findUniqueOrThrow({ where: { id } });
  if (row.status !== "PROPOSED") throw new Error("RECOMMENDATION_NOT_PROPOSED");
  const updated = await db.recommendation.update({ where: { id }, data: { status: decision } });
  await db.auditEntry.create({
    data: {
      id: randomUUID(),
      organizationId: row.organizationId,
      actorType: "HUMAN",
      actorId: "local-review",
      action: `RECOMMENDATION_${decision}`,
      targetType: "RECOMMENDATION",
      targetId: row.id,
      correlationId: `recommendation:${row.id}`,
      metadata: json({ evidenceRefs: row.evidenceRefs }),
      occurredAt: new Date(),
    },
  });
  return updated;
}

export async function markRecommendationApplied(db: PrismaClient, id: string) {
  const row = await db.recommendation.findUniqueOrThrow({ where: { id } });
  if (row.status !== "ACCEPTED") throw new Error("RECOMMENDATION_NOT_ACCEPTED");
  const updated = await db.recommendation.update({ where: { id }, data: { status: "APPLIED" } });
  await db.auditEntry.create({
    data: {
      id: randomUUID(),
      organizationId: row.organizationId,
      actorType: "HUMAN",
      actorId: "local-review",
      action: "RECOMMENDATION_MARKED_APPLIED",
      targetType: "RECOMMENDATION",
      targetId: row.id,
      correlationId: `recommendation:${row.id}`,
      metadata: json({ evidenceRefs: row.evidenceRefs }),
      occurredAt: new Date(),
    },
  });
  return updated;
}

export async function synthesizeExperimentRecommendation(db: PrismaClient, experimentId: string) {
  const experiment = await db.experiment.findUniqueOrThrow({ where: { id: experimentId } });
  if (experiment.status !== "COMPLETED" || !experiment.conclusion) throw new Error("EXPERIMENT_NOT_COMPLETE");

  let evidence = await db.evidence.findFirst({
    where: {
      organizationId: experiment.organizationId,
      brandId: experiment.brandId,
      sourceRef: `experiment:${experiment.id}`,
    },
    orderBy: { capturedAt: "desc" },
  });
  if (!evidence) {
    evidence = await captureEvidence(db, {
      organizationId: experiment.organizationId,
      brandId: experiment.brandId,
      sourceType: "EXPERIMENT_RESULT",
      sourceRef: `experiment:${experiment.id}`,
      content: {
        hypothesis: experiment.hypothesis,
        primaryMetric: experiment.primaryMetric,
        control: experiment.control,
        variants: experiment.variants,
        analysis: experiment.analysis,
        conclusion: experiment.conclusion,
      },
      confidence: "experiment-reviewed",
      freshness: "current",
      capturedAt: experiment.endAt ?? experiment.updatedAt,
      metadata: { experimentId: experiment.id },
    });
  }

  const evidenceRef = `evidence:${evidence.id}`;
  const existing = (await db.recommendation.findMany({
    where: {
      organizationId: experiment.organizationId,
      brandId: experiment.brandId,
      type: "EXPERIMENT_LEARNING",
      status: { not: "ARCHIVED" },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })).find((item) => {
    const refs = Array.isArray(item.evidenceRefs)
      ? item.evidenceRefs.filter((ref): ref is string => typeof ref === "string")
      : [];
    return refs.includes(evidenceRef);
  });
  if (existing) return existing;

  return proposeRecommendation(db, {
    type: "EXPERIMENT_LEARNING",
    title: `Experiment: ${experiment.hypothesis.slice(0, 100)}`,
    rationale: `Conclusion: ${experiment.conclusion}. Review evidence before applying this learning to strategy or prompts.`,
    evidenceRefs: [evidenceRef],
  });
}

export function recommendationCanMutateProduction(status: string) {
  return status === "ACCEPTED";
}
