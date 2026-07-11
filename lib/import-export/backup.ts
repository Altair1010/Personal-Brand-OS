// M10 full-DB backup — export/import all 22 entities as one JSON envelope.
// Decision: backup includes EVERYTHING (incl. PromptRun logs + PromptTemplate).
//
// Date fields: exportBackup returns raw Prisma rows (Date objects). The round-trip
// path is JSON.stringify → JSON.parse, which turns Dates into ISO strings. We rely on
// Prisma's built-in string→DateTime coercion on create/update, so importBackup accepts
// ISO-string dates as-is — no manual Date() coercion needed. cuids are preserved exactly
// (upsert on the PK id) so foreign keys stay valid across the round-trip.

import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";

export type BackupDb = PrismaClient;
export type BackupTx = Prisma.TransactionClient;

// --- all model names, in PARENT→CHILD order (FK-safe for insert/upsert) ---
// EM1c: FacebookAccount added after AppState, before Post (Post.facebookAccountId FK).
// PromptRun is placed BEFORE StrategyVersion/ContentDraft/PerformanceInsight because
// those hold an optional aiPromptRunId FK → PromptRun must exist first.
export const IMPORT_ORDER = [
  "AppState",
  "FacebookAccount",
  "UserProfile",
  "BrandDNA",
  "Goal",
  "ContentObjective",
  "Framework",
  "ContentTemplate",
  "PromptTemplate",
  "PromptRun",
  "AudienceSegment",
  "ContentPillar",
  "Strategy",
  "StrategyVersion",
  "WeeklyPlan",
  "DailyPlan",
  "ContentIdea",
  "ContentDraft",
  "Post",
  "MetricSnapshot",
  "PerformanceInsight",
  "AIModelConfig",
  "ExportHistory",
] as const;

export type BackupModel = (typeof IMPORT_ORDER)[number];

// Reverse order for deleteMany (children first). The reset action reuses wipeAll().
export const RESET_ORDER = [...IMPORT_ORDER].reverse() as BackupModel[];

// Map model name → Prisma delegate name (note the odd casings Prisma generates).
const DELEGATE: Record<BackupModel, keyof PrismaClient> = {
  AppState: "appState",
  FacebookAccount: "facebookAccount",
  UserProfile: "userProfile",
  BrandDNA: "brandDNA",
  Goal: "goal",
  ContentObjective: "contentObjective",
  Framework: "framework",
  ContentTemplate: "contentTemplate",
  PromptTemplate: "promptTemplate",
  PromptRun: "promptRun",
  AudienceSegment: "audienceSegment",
  ContentPillar: "contentPillar",
  Strategy: "strategy",
  StrategyVersion: "strategyVersion",
  WeeklyPlan: "weeklyPlan",
  DailyPlan: "dailyPlan",
  ContentIdea: "contentIdea",
  ContentDraft: "contentDraft",
  Post: "post",
  MetricSnapshot: "metricSnapshot",
  PerformanceInsight: "performanceInsight",
  AIModelConfig: "aIModelConfig",
  ExportHistory: "exportHistory",
} as const;

type Row = Record<string, unknown>;

export type BackupEnvelope = {
  version: number;
  exportedAt: string;
  data: Record<BackupModel, Row[]>;
};

// Structure-only validation: reject a corrupt/wrong file BEFORE any DB write.
// Per-row schemas are permissive on purpose (structure, not full field validation).
const rowSchema = z.record(z.string(), z.any());
const dataSchema = z.object(
  Object.fromEntries(IMPORT_ORDER.map((m) => [m, z.array(rowSchema)])) as Record<
    BackupModel,
    z.ZodArray<typeof rowSchema>
  >,
);

export const backupEnvelopeSchema = z.object({
  version: z.number(),
  exportedAt: z.string(),
  data: dataSchema,
});

// Helper: typed delegate accessor.
function delegate(db: BackupDb | BackupTx, model: BackupModel) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db as any)[DELEGATE[model]];
}

/** Read every table and return a versioned envelope. */
export async function exportBackup(db: BackupDb): Promise<BackupEnvelope> {
  const data = {} as Record<BackupModel, Row[]>;
  for (const model of IMPORT_ORDER) {
    data[model] = (await delegate(db, model).findMany()) as Row[];
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}

// Natural unique key for models whose upsert-where is NOT the id PK.
function whereFor(model: BackupModel, row: Row): Row {
  switch (model) {
    case "AppState":
      return { id: row.id };
    case "BrandDNA":
      return { userId: row.userId };
    case "ContentObjective":
      return { key: row.key };
    case "Framework":
      return { slug: row.slug };
    case "PromptTemplate":
      return { moduleKey_version: { moduleKey: row.moduleKey, version: row.version } };
    default:
      return { id: row.id };
  }
}

/**
 * Restore an envelope. Runs in ONE transaction, upserting parents before children.
 * Rows are written as-is (Json fields pass through; ISO-string dates coerced by Prisma).
 * cuids/PKs preserved so foreign keys stay valid.
 */
export async function importBackup(db: BackupDb, envelope: BackupEnvelope): Promise<void> {
  await db.$transaction(async (tx) => {
    for (const model of IMPORT_ORDER) {
      const rows = envelope.data[model] ?? [];
      for (const row of rows) {
        await delegate(tx, model).upsert({
          where: whereFor(model, row),
          update: row,
          create: row,
        });
      }
    }
  });
}

/** deleteMany every table in FK-safe reverse order. Reused by the M10 reset action. */
export async function wipeAll(tx: BackupTx | BackupDb): Promise<void> {
  for (const model of RESET_ORDER) {
    await delegate(tx, model).deleteMany();
  }
}
