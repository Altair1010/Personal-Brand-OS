import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";
import { captureEvidence } from "@/lib/piltover/vnext/evidence-service";

const json = (value: unknown) => value as Prisma.InputJsonValue;
export const EXPERIMENT_STATES = ["DRAFT", "READY", "RUNNING", "PAUSED", "COMPLETED", "ARCHIVED"] as const;

export async function createExperiment(db: PrismaClient, input: {
  hypothesis: string;
  entityType: string;
  control?: unknown;
  variants: unknown[];
  primaryMetric: string;
  secondaryMetrics?: string[];
  startAt?: Date | null;
  endAt?: Date | null;
  sample?: unknown;
}) {
  const tenant = await resolveLocalTenant(db);
  if (!input.hypothesis.trim()) throw new Error("HYPOTHESIS_REQUIRED");
  if (!input.primaryMetric.trim()) throw new Error("PRIMARY_METRIC_REQUIRED");
  if (!Array.isArray(input.variants) || input.variants.length < 1) throw new Error("VARIANT_REQUIRED");
  return db.experiment.create({
    data: {
      id: randomUUID(),
      organizationId: tenant.organizationId,
      brandId: tenant.brandId,
      hypothesis: input.hypothesis.trim(),
      entityType: input.entityType,
      control: input.control === undefined ? undefined : json(input.control),
      variants: json(input.variants),
      primaryMetric: input.primaryMetric,
      secondaryMetrics: json(input.secondaryMetrics ?? []),
      startAt: input.startAt ?? null,
      endAt: input.endAt ?? null,
      sample: input.sample === undefined ? undefined : json(input.sample),
      status: "DRAFT",
    },
  });
}

export async function transitionExperiment(db: PrismaClient, id: string, next: typeof EXPERIMENT_STATES[number]) {
  const current = await db.experiment.findUniqueOrThrow({ where: { id } });
  const allowed: Record<string, readonly string[]> = {
    DRAFT: ["READY", "ARCHIVED"],
    READY: ["RUNNING", "DRAFT", "ARCHIVED"],
    RUNNING: ["PAUSED", "COMPLETED"],
    PAUSED: ["RUNNING", "COMPLETED", "ARCHIVED"],
    COMPLETED: ["ARCHIVED"],
    ARCHIVED: [],
  };
  if (!(allowed[current.status] ?? []).includes(next)) throw new Error("INVALID_EXPERIMENT_TRANSITION");
  return db.experiment.update({ where: { id }, data: { status: next } });
}

type VariantSummary = { id: string; n: number; mean: number };

export function analyzeExperiment(input: {
  control: VariantSummary;
  variants: VariantSummary[];
  minimumSample?: number;
  minimumRelativeLift?: number;
}) {
  const minimumSample = input.minimumSample ?? 30;
  const minimumRelativeLift = input.minimumRelativeLift ?? 0.05;
  const results = input.variants.map((variant) => {
    const lift = input.control.mean === 0 ? null : (variant.mean - input.control.mean) / Math.abs(input.control.mean);
    const sufficientSample = input.control.n >= minimumSample && variant.n >= minimumSample;
    const meaningfulLift = lift !== null && Math.abs(lift) >= minimumRelativeLift;
    return {
      ...variant,
      lift,
      sufficientSample,
      meaningfulLift,
      decision: sufficientSample && meaningfulLift ? (lift! > 0 ? "PROMISING" : "UNDERPERFORMING") : "INCONCLUSIVE",
    };
  });
  return {
    control: input.control,
    results,
    conclusion: results.some((row) => row.decision === "PROMISING")
      ? "PROMISING_VARIANT"
      : results.every((row) => row.decision === "INCONCLUSIVE")
        ? "INCONCLUSIVE"
        : "NO_POSITIVE_LIFT",
  };
}

export async function completeExperiment(db: PrismaClient, input: {
  id: string;
  analysis: unknown;
  conclusion: string;
}) {
  const experiment = await db.experiment.findUniqueOrThrow({ where: { id: input.id } });
  if (!["RUNNING", "PAUSED"].includes(experiment.status)) throw new Error("EXPERIMENT_NOT_RUNNING");
  const completed = await db.experiment.update({
    where: { id: input.id },
    data: { analysis: json(input.analysis), conclusion: input.conclusion, status: "COMPLETED", endAt: experiment.endAt ?? new Date() },
  });
  await captureEvidence(db, {
    organizationId: completed.organizationId,
    brandId: completed.brandId,
    sourceType: "EXPERIMENT_RESULT",
    sourceRef: `experiment:${completed.id}`,
    content: {
      hypothesis: completed.hypothesis,
      primaryMetric: completed.primaryMetric,
      analysis: input.analysis,
      conclusion: input.conclusion,
    },
    confidence: "experimental",
    freshness: "current",
    capturedAt: completed.endAt ?? new Date(),
  });
  return completed;
}
