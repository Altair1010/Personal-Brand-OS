import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";
import { compareEvalRuns } from "@/lib/piltover/vnext/eval-engine";

const json = (value: unknown) => value as Prisma.InputJsonValue;

export async function persistEvaluationRun(db: PrismaClient, input: {
  subjectType: string;
  subjectRef: string;
  suiteRef?: string | null;
  baselineRef?: string | null;
  candidateRef?: string | null;
  score: number;
  baselineScore?: number | null;
  result: unknown;
  tolerance?: number;
}) {
  const tenant = await resolveLocalTenant(db);
  const comparison = typeof input.baselineScore === "number"
    ? compareEvalRuns({ score: input.baselineScore }, { score: input.score }, input.tolerance ?? 0)
    : null;
  const status = comparison?.regressed ? "REGRESSED" : input.score >= 0.8 ? "PASSED" : "FAILED";
  return db.evaluationRun.create({
    data: {
      id: randomUUID(),
      organizationId: tenant.organizationId,
      brandId: tenant.brandId,
      subjectType: input.subjectType,
      subjectRef: input.subjectRef,
      suiteRef: input.suiteRef ?? null,
      baselineRef: input.baselineRef ?? null,
      candidateRef: input.candidateRef ?? null,
      status,
      score: input.score,
      baselineScore: input.baselineScore ?? null,
      delta: comparison?.delta ?? null,
      result: json(input.result),
    },
  });
}

export async function latestPassingEvaluation(db: PrismaClient, input: {
  subjectType: string;
  subjectRef: string;
  candidateRef?: string | null;
}) {
  const tenant = await resolveLocalTenant(db);
  return db.evaluationRun.findFirst({
    where: {
      organizationId: tenant.organizationId,
      brandId: tenant.brandId,
      subjectType: input.subjectType,
      subjectRef: input.subjectRef,
      candidateRef: input.candidateRef ?? undefined,
      status: "PASSED",
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function assertPromotionEvaluation(db: PrismaClient, input: {
  subjectType: string;
  subjectRef: string;
  candidateRef: string;
}) {
  const row = await latestPassingEvaluation(db, input);
  if (!row) throw new Error("PASSING_EVALUATION_REQUIRED");
  return row;
}
