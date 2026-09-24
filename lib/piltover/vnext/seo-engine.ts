import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { captureEvidence } from "@/lib/piltover/vnext/evidence-service";

const json = (value: unknown) => value as Prisma.InputJsonValue;

export type SeoSignals = {
  title?: string | null;
  description?: string | null;
  canonical?: string | null;
  h1Count: number;
  imageCount: number;
  imagesWithoutAlt: number;
  internalLinks: number;
  externalLinks: number;
  wordCount: number;
  robotsNoindex?: boolean;
  structuredDataCount?: number;
};

export function evaluateSeoSignals(signals: SeoSignals) {
  const findings: Array<{ code: string; severity: "info" | "warning" | "error"; message: string }> = [];
  if (!signals.title?.trim()) findings.push({ code: "TITLE_MISSING", severity: "error", message: "Title tag is missing." });
  else if (signals.title.length > 65) findings.push({ code: "TITLE_LONG", severity: "warning", message: "Title is longer than 65 characters." });
  if (!signals.description?.trim()) findings.push({ code: "META_DESCRIPTION_MISSING", severity: "warning", message: "Meta description is missing." });
  if (signals.h1Count === 0) findings.push({ code: "H1_MISSING", severity: "error", message: "No H1 found." });
  if (signals.h1Count > 1) findings.push({ code: "H1_MULTIPLE", severity: "warning", message: "Multiple H1 elements found." });
  if (signals.imagesWithoutAlt > 0) findings.push({ code: "IMAGE_ALT_MISSING", severity: "warning", message: `${signals.imagesWithoutAlt} images are missing alt text.` });
  if (signals.robotsNoindex) findings.push({ code: "NOINDEX", severity: "warning", message: "Page is marked noindex." });
  if (signals.wordCount < 150) findings.push({ code: "THIN_CONTENT", severity: "info", message: "Low text volume; review content intent before changing." });
  return findings;
}

export async function persistSeoAudit(db: PrismaClient, input: {
  organizationId: string; brandId: string; domain: string; signals: SeoSignals; source: string;
}) {
  const findings = evaluateSeoSignals(input.signals);
  const row = await db.sEOAuditSnapshot.create({
    data: {
      id: randomUUID(), organizationId: input.organizationId, brandId: input.brandId,
      domain: input.domain, extractorVersion: "piltover-deterministic-seo:v1",
      signals: json(input.signals), findings: json(findings), source: input.source, capturedAt: new Date(),
    },
  });
  await captureEvidence(db, {
    organizationId: input.organizationId,
    brandId: input.brandId,
    sourceType: "SEO_AUDIT",
    sourceRef: `seoAudit:${row.id}`,
    content: { domain: input.domain, signals: input.signals, findings },
    confidence: "deterministic",
    freshness: "current",
    capturedAt: row.capturedAt,
    metadata: { auditId: row.id, extractorVersion: row.extractorVersion },
  });
  return row;
}

export interface SEOProvider {
  id: string;
  research(input: { kind: string; query?: string; context?: unknown }): Promise<unknown>;
}

export async function persistSeoResearch(db: PrismaClient, input: {
  organizationId: string;
  brandId: string;
  kind: string;
  query?: string;
  provider: string;
  data: unknown;
  evidenceRefs?: string[];
}) {
  const row = await db.sEOResearchArtifact.create({
    data: {
      id: randomUUID(),
      organizationId: input.organizationId,
      brandId: input.brandId,
      kind: input.kind,
      query: input.query ?? null,
      provider: input.provider,
      data: json(input.data),
      evidenceRefs: json(input.evidenceRefs ?? []),
      capturedAt: new Date(),
    },
  });
  await captureEvidence(db, {
    organizationId: input.organizationId,
    brandId: input.brandId,
    sourceType: "SEO_RESEARCH",
    sourceRef: `seoResearch:${row.id}`,
    content: { kind: input.kind, query: input.query ?? null, provider: input.provider, data: input.data },
    confidence: "provider",
    freshness: "current",
    capturedAt: row.capturedAt,
    metadata: { researchArtifactId: row.id },
  });
  return row;
}

export async function persistAiVisibility(db: PrismaClient, input: {
  organizationId: string;
  brandId: string;
  provider: string;
  promptSet: unknown;
  brandMentions: unknown;
  sourceMentions: unknown;
  competitorMentions: unknown;
  citedPages: unknown;
}) {
  const row = await db.aIVisibilitySnapshot.create({
    data: {
      id: randomUUID(),
      organizationId: input.organizationId,
      brandId: input.brandId,
      provider: input.provider,
      promptSet: json(input.promptSet),
      brandMentions: json(input.brandMentions),
      sourceMentions: json(input.sourceMentions),
      competitorMentions: json(input.competitorMentions),
      citedPages: json(input.citedPages),
      capturedAt: new Date(),
    },
  });
  await captureEvidence(db, {
    organizationId: input.organizationId,
    brandId: input.brandId,
    sourceType: "AI_VISIBILITY",
    sourceRef: `aiVisibility:${row.id}`,
    content: {
      provider: input.provider,
      promptSet: input.promptSet,
      brandMentions: input.brandMentions,
      sourceMentions: input.sourceMentions,
      competitorMentions: input.competitorMentions,
      citedPages: input.citedPages,
    },
    confidence: "provider",
    freshness: "current",
    capturedAt: row.capturedAt,
    metadata: { visibilitySnapshotId: row.id },
  });
  return row;
}
