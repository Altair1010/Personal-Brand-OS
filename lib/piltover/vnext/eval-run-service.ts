import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";
import { compareEvalRuns, runEvalSuite, type EvalCase } from "@/lib/piltover/vnext/eval-engine";

const json = (value: unknown) => value as Prisma.InputJsonValue;

export async function executeAndPersistEval<TInput, TOutput>(
  db: PrismaClient,
  input: {
    subjectType: "AGENT" | "PROMPT" | "SKILL" | "CONTENT_ENGINE" | "MODEL";
    subjectRef: string;
    suiteRef?: string;
    baselineRef?: string;
    candidateRef?: string;
    baselineScore?: number;
    tolerance?: number;
    cases: EvalCase<TInput, TOutput>[];
    runner: (value: TInput) => Promise<TOutput>;
  },
) {
  const tenant = await resolveLocalTenant(db);
  const suite = await runEvalSuite({ cases: input.cases, runner: input.runner });
  const comparison = typeof input.baselineScore === "number"
    ? compareEvalRuns({ score: input.baselineScore }, { score: suite.score }, input.tolerance ?? 0)
    : null;
  const status = suite.passed && !comparison?.regressed ? "PASSED" : "FAILED";
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
      score: suite.score,
      baselineScore: input.baselineScore ?? null,
      delta: comparison?.delta ?? null,
      result: json({ ...suite, comparison }),
    },
  });
}

export async function listEvaluationRuns(db: PrismaClient, limit = 100) {
  const tenant = await resolveLocalTenant(db);
  return db.evaluationRun.findMany({
    where: { organizationId: tenant.organizationId, OR: [{ brandId: tenant.brandId }, { brandId: null }] },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
