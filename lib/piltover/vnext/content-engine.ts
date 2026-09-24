import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";

const TextPostSchema = z.object({
  hook: z.string(),
  body: z.string(),
  cta: z.string(),
  hashtags: z.array(z.string()),
});

const ImagePostSchema = z.object({
  caption: z.string(),
  hook: z.string(),
  body: z.string(),
  cta: z.string(),
  hashtags: z.array(z.string()),
  visualBrief: z.string(),
});

const CarouselSchema = z.object({
  cover: z.object({ headline: z.string(), visualDirection: z.string().optional() }),
  slides: z.array(z.object({ headline: z.string(), body: z.string(), visualDirection: z.string().optional() })).min(2),
  finalSlide: z.object({ headline: z.string(), cta: z.string() }),
  caption: z.string(),
  hashtags: z.array(z.string()),
});

const VideoSchema = z.object({
  hook: z.string(),
  scenes: z.array(z.object({ duration: z.string(), visual: z.string(), voiceover: z.string(), overlay: z.string().optional() })).min(1),
  cta: z.string(),
  caption: z.string(),
  hashtags: z.array(z.string()),
});

export const ContentMasterPayloadSchema = z.discriminatedUnion("schemaType", [
  z.object({ schemaType: z.literal("TEXT_POST"), data: TextPostSchema }),
  z.object({ schemaType: z.literal("IMAGE_POST"), data: ImagePostSchema }),
  z.object({ schemaType: z.literal("CAROUSEL"), data: CarouselSchema }),
  z.object({ schemaType: z.enum(["VIDEO", "REEL"]), data: VideoSchema }),
]);

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function normalizeHashtag(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D")
    .replace(/^#+/, "").replace(/\s+/g, "").replace(/[^a-zA-Z0-9_]/g, "");
}

export function deterministicContentChecks(payload: z.infer<typeof ContentMasterPayloadSchema>) {
  const text = JSON.stringify(payload.data);
  const hashtags = "hashtags" in payload.data ? payload.data.hashtags : [];
  const normalized = hashtags.map(normalizeHashtag).filter(Boolean);
  const failures: string[] = [];
  if (!text.trim()) failures.push("EMPTY_CONTENT");
  if (normalized.some((tag) => tag.length > 80)) failures.push("HASHTAG_TOO_LONG");
  if (/bản nháp mới|new draft/i.test(text)) failures.push("UI_STATE_LEAK");
  return { status: failures.length ? "NEEDS_REVISION" : "PASS", failures, normalizedHashtags: normalized };
}

export async function createContentBrief(db: PrismaClient, input: {
  objective: string; audienceRef?: string; campaignId?: string; keyMessage?: string; offer?: string;
  format: string; channel: string; tone?: string; intensity?: string; hookDirection?: string;
  length?: string; cta?: string; evidenceRefs?: string[]; requiredPoints?: string[]; forbiddenPoints?: string[];
}) {
  const tenant = await resolveLocalTenant(db);
  return db.contentBrief.create({
    data: {
      id: randomUUID(), organizationId: tenant.organizationId, workspaceId: tenant.workspaceId, brandId: tenant.brandId,
      campaignId: input.campaignId ?? null, objective: input.objective, audienceRef: input.audienceRef ?? null,
      keyMessage: input.keyMessage ?? null, offer: input.offer ?? null, format: input.format, channel: input.channel,
      tone: input.tone ?? null, intensity: input.intensity ?? null, hookDirection: input.hookDirection ?? null,
      length: input.length ?? null, cta: input.cta ?? null, evidenceRefs: json(input.evidenceRefs ?? []),
      requiredPoints: json(input.requiredPoints ?? []), forbiddenPoints: json(input.forbiddenPoints ?? []),
    },
  });
}

const TERRITORY_MECHANISMS = [
  "Contrast",
  "SemanticHijack",
  "ContextTransfer",
  "ObjectVoice",
  "Wordplay",
  "StructuralDecomposition",
  "CulturalReference",
  "Understatement",
] as const;

export async function createCreativeTerritories(db: PrismaClient, input: {
  briefId: string;
  territories: Array<{
    insight: string;
    tension?: string;
    promise?: string;
    emotionalDirection?: string;
    semanticConnection?: string;
    visualMetaphor?: string;
    tone?: string;
    mechanism: string;
  }>;
}) {
  const brief = await db.contentBrief.findUnique({ where: { id: input.briefId } });
  if (!brief) throw new Error("CONTENT_BRIEF_NOT_FOUND");
  const unique = new Set<string>();
  const rows = input.territories.map((item) => {
    const mechanism = item.mechanism.trim();
    if (!mechanism) throw new Error("CREATIVE_MECHANISM_REQUIRED");
    if (unique.has(mechanism.toLowerCase())) throw new Error("CREATIVE_TERRITORIES_MUST_USE_DISTINCT_MECHANISMS");
    unique.add(mechanism.toLowerCase());
    return {
      id: randomUUID(),
      contentBriefId: brief.id,
      insight: item.insight,
      tension: item.tension ?? null,
      promise: item.promise ?? null,
      emotionalDirection: item.emotionalDirection ?? null,
      semanticConnection: item.semanticConnection ?? null,
      visualMetaphor: item.visualMetaphor ?? null,
      tone: item.tone ?? brief.tone,
      mechanism: TERRITORY_MECHANISMS.includes(mechanism as never) ? mechanism : mechanism,
    };
  });
  if (rows.length < 2) throw new Error("AT_LEAST_TWO_CREATIVE_TERRITORIES_REQUIRED");
  await db.creativeTerritory.createMany({ data: rows });
  return db.creativeTerritory.findMany({ where: { id: { in: rows.map((row) => row.id) } } });
}

export async function createContentConcept(db: PrismaClient, input: {
  briefId: string;
  creativeTerritoryId?: string;
  title: string;
  concept: unknown;
  selected?: boolean;
}) {
  const territory = input.creativeTerritoryId
    ? await db.creativeTerritory.findUnique({ where: { id: input.creativeTerritoryId } })
    : null;
  if (territory && territory.contentBriefId !== input.briefId) throw new Error("TERRITORY_BRIEF_MISMATCH");
  return db.contentConcept.create({
    data: {
      id: randomUUID(),
      contentBriefId: input.briefId,
      creativeTerritoryId: input.creativeTerritoryId ?? null,
      title: input.title,
      concept: json(input.concept),
      selected: input.selected ?? false,
    },
  });
}

export async function saveContentMaster(db: PrismaClient, input: {
  briefId: string; conceptId?: string; payload: z.infer<typeof ContentMasterPayloadSchema>;
}) {
  const tenant = await resolveLocalTenant(db);
  const parsed = ContentMasterPayloadSchema.parse(input.payload);
  const checks = deterministicContentChecks(parsed);
  return db.$transaction(async (tx) => {
    const latest = await tx.contentMaster.findFirst({ where: { contentBriefId: input.briefId }, orderBy: { version: "desc" } });
    const master = await tx.contentMaster.create({
      data: {
        id: randomUUID(), organizationId: tenant.organizationId, brandId: tenant.brandId,
        contentBriefId: input.briefId, conceptId: input.conceptId ?? null, schemaType: parsed.schemaType,
        content: json(parsed.data), version: (latest?.version ?? 0) + 1, status: checks.status === "PASS" ? "DRAFT" : "NEEDS_REVIEW",
      },
    });
    await tx.qualityGate.create({
      data: {
        id: randomUUID(), artifactType: "CONTENT_MASTER", artifactId: master.id, evaluator: "deterministic:v1",
        criteria: json(["non_empty", "hashtag_valid", "no_ui_state_leak"]), scores: json({ pass: checks.failures.length === 0 }),
        status: checks.status, evidence: json({ failures: checks.failures }), recommendations: json([]),
      },
    });
    return { master, checks };
  });
}

export async function createChannelVariant(db: PrismaClient, input: {
  contentMasterId: string; channel: string; format: string; content: unknown;
}) {
  return db.channelVariant.create({
    data: {
      id: randomUUID(),
      contentMasterId: input.contentMasterId,
      channel: input.channel,
      format: input.format,
      content: json(input.content),
      status: "DRAFT",
    },
  });
}
