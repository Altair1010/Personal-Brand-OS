import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";

const json = (value: unknown) => value as Prisma.InputJsonValue;

export async function captureEvidence(db: PrismaClient, input: {
  sourceType: string;
  sourceRef?: string | null;
  content: unknown;
  confidence?: string | null;
  freshness?: string | null;
  metadata?: unknown;
  capturedAt?: Date;
  organizationId?: string;
  brandId?: string | null;
}) {
  const tenant = input.organizationId ? null : await resolveLocalTenant(db);
  return db.evidence.create({
    data: {
      id: randomUUID(),
      organizationId: input.organizationId ?? tenant!.organizationId,
      brandId: input.brandId === undefined ? tenant!.brandId : input.brandId,
      sourceType: input.sourceType,
      sourceRef: input.sourceRef ?? null,
      content: json(input.content),
      confidence: input.confidence ?? null,
      freshness: input.freshness ?? null,
      metadata: input.metadata === undefined ? undefined : json(input.metadata),
      capturedAt: input.capturedAt ?? new Date(),
    },
  });
}

export async function resolveEvidenceRefs(db: PrismaClient, refs: string[]) {
  const ids = refs
    .map((ref) => ref.startsWith("evidence:") ? ref.slice("evidence:".length) : null)
    .filter((value): value is string => Boolean(value));
  const performanceIds = refs
    .map((ref) => ref.startsWith("performance:") ? ref.slice("performance:".length) : null)
    .filter((value): value is string => Boolean(value));
  const directRefs = refs.filter((ref) => !ref.startsWith("evidence:") && !ref.startsWith("performance:"));
  const [evidence, snapshots] = await Promise.all([
    db.evidence.findMany({
      where: {
        OR: [
          ...(ids.length ? [{ id: { in: ids } }] : []),
          ...(directRefs.length ? [{ sourceRef: { in: directRefs } }] : []),
          ...(performanceIds.length ? [{ sourceRef: { in: performanceIds.map((id) => `performance:${id}`) } }] : []),
        ],
      },
      orderBy: { capturedAt: "desc" },
    }),
    performanceIds.length
      ? db.performanceSnapshot.findMany({ where: { id: { in: performanceIds } }, orderBy: { capturedAt: "desc" } })
      : Promise.resolve([]),
  ]);
  return { evidence, snapshots };
}
