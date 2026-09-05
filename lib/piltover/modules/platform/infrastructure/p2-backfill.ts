import { createHash, randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

type P2Database = PrismaClient;

export class P2MigrationConflictError extends Error {
  constructor(
    readonly code: string,
    readonly relationFamily: string,
    readonly recordId: string,
  ) {
    super(`${code}:${relationFamily}:${recordId}`);
    this.name = "P2MigrationConflictError";
  }
}

type CreatedCounts = {
  userIdentities: number;
  authIdentities: number;
  organizations: number;
  workspaces: number;
  brands: number;
  memberships: number;
  metricObservations: number;
};

export interface P2BackfillReport {
  readonly profilesProcessed: number;
  readonly created: CreatedCounts;
  readonly promptRuns: {
    readonly scoped: string[];
    readonly legacyUnscoped: string[];
    readonly conflicts: string[];
  };
  readonly quarantinedFacebookAccounts: string[];
}

const DIRECT_SCOPED_DELEGATES = [
  "brandDNA",
  "goal",
  "audienceSegment",
  "contentPillar",
  "strategy",
  "contentIdea",
  "contentDraft",
  "post",
  "performanceInsight",
  "exportHistory",
] as const;

const DIRECT_SCOPE_TABLES = [
  ["BrandDNA", "BRAND_DNA", "userId"],
  ["Goal", "GOAL", "userId"],
  ["AudienceSegment", "AUDIENCE_SEGMENT", "userId"],
  ["ContentPillar", "CONTENT_PILLAR", "userId"],
  ["Strategy", "STRATEGY", "userId"],
  ["ContentIdea", "CONTENT_IDEA", "userId"],
  ["ContentDraft", "CONTENT_DRAFT", "userId"],
  ["Post", "POST", "userId"],
  ["PerformanceInsight", "PERFORMANCE_INSIGHT", "userId"],
  ["ExportHistory", "EXPORT_HISTORY", "userId"],
  ["ContentTemplate", "CONTENT_TEMPLATE", "userId"],
  ["Framework", "FRAMEWORK", "userId"],
  ["FacebookAccount", "FACEBOOK_ACCOUNT", "ownerRef"],
] as const;

const LEGACY_RELATION_CHECKS = [
  ["AUDIENCE_SEGMENT_GOAL", `SELECT c.id FROM AudienceSegment c JOIN Goal p ON p.id = c.goalId WHERE c.userId <> p.userId ORDER BY c.id LIMIT 1`],
  ["CONTENT_PILLAR_GOAL", `SELECT c.id FROM ContentPillar c JOIN Goal p ON p.id = c.goalId WHERE c.userId <> p.userId ORDER BY c.id LIMIT 1`],
  ["STRATEGY_GOAL", `SELECT c.id FROM Strategy c JOIN Goal p ON p.id = c.goalId WHERE c.userId <> p.userId ORDER BY c.id LIMIT 1`],
  ["CONTENT_IDEA_DAILY_PLAN", `SELECT c.id FROM ContentIdea c JOIN DailyPlan d ON d.id = c.dailyPlanId JOIN WeeklyPlan w ON w.id = d.weeklyPlanId JOIN StrategyVersion v ON v.id = w.strategyVersionId JOIN Strategy s ON s.id = v.strategyId WHERE c.userId <> s.userId ORDER BY c.id LIMIT 1`],
  ["CONTENT_IDEA_PILLAR", `SELECT c.id FROM ContentIdea c JOIN ContentPillar p ON p.id = c.pillarId WHERE c.userId <> p.userId ORDER BY c.id LIMIT 1`],
  ["DAILY_PLAN_PILLAR", `SELECT d.id FROM DailyPlan d JOIN WeeklyPlan w ON w.id = d.weeklyPlanId JOIN StrategyVersion v ON v.id = w.strategyVersionId JOIN Strategy s ON s.id = v.strategyId JOIN ContentPillar p ON p.id = d.plannedPillarId WHERE s.userId <> p.userId ORDER BY d.id LIMIT 1`],
  ["WEEKLY_PLAN_FOCUS_PILLAR", `SELECT w.id FROM WeeklyPlan w JOIN StrategyVersion v ON v.id = w.strategyVersionId JOIN Strategy s ON s.id = v.strategyId JOIN ContentPillar p ON p.id = w.focusPillarId WHERE s.userId <> p.userId ORDER BY w.id LIMIT 1`],
  ["CONTENT_DRAFT_IDEA", `SELECT c.id FROM ContentDraft c JOIN ContentIdea p ON p.id = c.contentIdeaId WHERE c.userId <> p.userId ORDER BY c.id LIMIT 1`],
  ["CONTENT_DRAFT_PILLAR", `SELECT c.id FROM ContentDraft c JOIN ContentPillar p ON p.id = c.pillarId WHERE c.userId <> p.userId ORDER BY c.id LIMIT 1`],
  ["POST_DRAFT", `SELECT c.id FROM Post c JOIN ContentDraft p ON p.id = c.contentDraftId WHERE c.userId <> p.userId ORDER BY c.id LIMIT 1`],
  ["POST_PILLAR", `SELECT c.id FROM Post c JOIN ContentPillar p ON p.id = c.pillarId WHERE c.userId <> p.userId ORDER BY c.id LIMIT 1`],
  ["POST_STRATEGY_VERSION", `SELECT c.id FROM Post c JOIN StrategyVersion v ON v.id = c.strategyVersionId JOIN Strategy p ON p.id = v.strategyId WHERE c.userId <> p.userId ORDER BY c.id LIMIT 1`],
  ["POST_DAILY_PLAN", `SELECT c.id FROM Post c JOIN DailyPlan d ON d.id = c.dailyPlanId JOIN WeeklyPlan w ON w.id = d.weeklyPlanId JOIN StrategyVersion v ON v.id = w.strategyVersionId JOIN Strategy p ON p.id = v.strategyId WHERE c.userId <> p.userId ORDER BY c.id LIMIT 1`],
  ["POST_FACEBOOK_ACCOUNT", `SELECT c.id FROM Post c JOIN FacebookAccount p ON p.id = c.facebookAccountId WHERE c.userId <> p.ownerRef ORDER BY c.id LIMIT 1`],
  ["STRATEGY_FRAMEWORK", `SELECT c.id FROM Strategy c JOIN Framework p ON p.slug = c.frameworkSlug WHERE p.userId IS NOT NULL AND c.userId <> p.userId ORDER BY c.id LIMIT 1`],
  ["METRIC_OBSERVATION_POST", `SELECT c.id FROM MetricObservation c JOIN Post p ON p.id = c.legacyPostId WHERE p.organizationId IS NULL OR p.brandId IS NULL OR c.organizationId <> p.organizationId OR c.brandId <> p.brandId ORDER BY c.id LIMIT 1`],
] as const;

const NUMERIC_METRICS = ["reach", "engagement", "comments", "shares", "saves"] as const;
const TEXT_METRICS = [
  ["inboxNote", "inbox_note"],
  ["conversionNote", "conversion_note"],
] as const;

function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash("sha256").update(value, "utf8").digest("hex").slice(0, 48)}`;
}

function metricDedupeKey(parts: readonly string[]): string {
  return createHash("sha256").update(parts.join("|"), "utf8").digest("hex");
}

function stripSecretFields(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) {
    return value.map(stripSecretFields).filter((item) => item !== undefined);
  }
  if (typeof value !== "object") return undefined;

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (/(token|secret|password|api.?key|authorization)/i.test(key)) continue;
    const sanitized = stripSecretFields(item);
    if (sanitized !== undefined) result[key] = sanitized;
  }
  return result;
}

async function ensureProfileGraph(
  db: P2Database,
  profile: { id: string; name: string; userIdentityId: string | null },
  supabaseSubject: string | null,
  created: CreatedCounts,
): Promise<{ organizationId: string; workspaceId: string; brandId: string }> {
  return db.$transaction(async (tx) => {
    let identityId = profile.userIdentityId;
    if (!identityId) {
      identityId = `usr_${randomUUID().replaceAll("-", "")}`;
      await tx.userIdentity.create({ data: { id: identityId } });
      await tx.userProfile.update({ where: { id: profile.id }, data: { userIdentityId: identityId } });
      created.userIdentities += 1;
    }

    const organizationId = stableId("org", `organization|${identityId}`);
    const workspaceId = stableId("wsp", `workspace|${identityId}`);
    const brandId = stableId("brd", `brand|${identityId}`);
    const membershipId = stableId("mem", `membership|${identityId}|${organizationId}`);
    const brandDna = await tx.brandDNA.findUnique({
      where: { userId: profile.id },
      select: { companyName: true },
    });

    if (!(await tx.organization.findUnique({ where: { id: organizationId } }))) {
      await tx.organization.create({
        data: { id: organizationId, name: `${profile.name} Organization` },
      });
      created.organizations += 1;
    }
    if (!(await tx.workspace.findUnique({ where: { id: workspaceId } }))) {
      await tx.workspace.create({
        data: { id: workspaceId, organizationId, name: `${profile.name} Workspace` },
      });
      created.workspaces += 1;
    }
    if (!(await tx.brand.findUnique({ where: { id: brandId } }))) {
      await tx.brand.create({
        data: {
          id: brandId,
          organizationId,
          workspaceId,
          name: brandDna?.companyName?.trim() || `${profile.name} Brand`,
        },
      });
      created.brands += 1;
    }
    if (!(await tx.membership.findUnique({ where: { id: membershipId } }))) {
      await tx.membership.create({
        data: {
          id: membershipId,
          userIdentityId: identityId,
          organizationId,
          organizationRole: "OWNER",
        },
      });
      created.memberships += 1;
    }

    if (profile.id === "local" && supabaseSubject) {
      const existing = await tx.authIdentity.findUnique({
        where: { provider_subject: { provider: "supabase", subject: supabaseSubject } },
      });
      if (existing && existing.userIdentityId !== identityId) {
        throw new Error("MIGRATION_DUPLICATE_AUTH_SUBJECT");
      }
      if (!existing) {
        await tx.authIdentity.create({
          data: {
            id: stableId("auth", `supabase|${supabaseSubject}`),
            userIdentityId: identityId,
            provider: "supabase",
            subject: supabaseSubject,
          },
        });
        created.authIdentities += 1;
      }
    }

    for (const delegateName of DIRECT_SCOPED_DELEGATES) {
      const delegate = tx[delegateName] as unknown as {
        updateMany(args: unknown): Promise<unknown>;
      };
      await delegate.updateMany({
        where: { userId: profile.id, organizationId: null, brandId: null },
        data: { organizationId, brandId },
      });
    }
    await tx.contentTemplate.updateMany({
      where: { userId: profile.id, organizationId: null, brandId: null },
      data: { organizationId, brandId },
    });
    await tx.framework.updateMany({
      where: { userId: profile.id, organizationId: null, brandId: null },
      data: { organizationId, brandId },
    });
    await tx.facebookAccount.updateMany({
      where: { ownerRef: profile.id, organizationId: null, brandId: null },
      data: { organizationId, brandId },
    });

    return { organizationId, workspaceId, brandId };
  });
}

async function scopePromptRuns(db: P2Database): Promise<P2BackfillReport["promptRuns"]> {
  const report = { scoped: [] as string[], legacyUnscoped: [] as string[], conflicts: [] as string[] };
  const runs = await db.promptRun.findMany({
    include: {
      strategyVersions: { include: { strategy: { select: { organizationId: true, brandId: true } } } },
      drafts: { select: { organizationId: true, brandId: true } },
      insights: { select: { organizationId: true, brandId: true } },
    },
    orderBy: { id: "asc" },
  });

  for (const run of runs) {
    const consumers = [
      ...run.strategyVersions.map((version) => version.strategy),
      ...run.drafts,
      ...run.insights,
    ];
    if (consumers.length === 0) {
      report.legacyUnscoped.push(run.id);
      continue;
    }
    const unresolved = consumers.some((owner) => !owner.organizationId || !owner.brandId);
    const owners = new Set(
      consumers
        .filter((owner) => owner.organizationId && owner.brandId)
        .map((owner) => `${owner.organizationId}|${owner.brandId}`),
    );
    if (unresolved || owners.size !== 1) {
      report.conflicts.push(run.id);
      continue;
    }
    const [organizationId, brandId] = [...owners][0].split("|");
    if ((run.organizationId || run.brandId) && (run.organizationId !== organizationId || run.brandId !== brandId)) {
      report.conflicts.push(run.id);
      continue;
    }
    if (run.organizationId !== organizationId || run.brandId !== brandId) {
      await db.promptRun.update({ where: { id: run.id }, data: { organizationId, brandId } });
    }
    report.scoped.push(run.id);
  }
  return report;
}

async function backfillMetricObservations(
  db: P2Database,
  created: CreatedCounts,
): Promise<void> {
  const snapshots = await db.metricSnapshot.findMany({
    include: { post: { select: { organizationId: true, brandId: true } } },
  });
  for (const snapshot of snapshots) {
    if (!snapshot.post.organizationId || !snapshot.post.brandId) {
      throw new Error(`MIGRATION_UNSCOPED_METRIC_POST:${snapshot.id}`);
    }
    const base = {
      organizationId: snapshot.post.organizationId,
      brandId: snapshot.post.brandId,
      legacyPostId: snapshot.postId,
      observedAt: snapshot.capturedAt,
      source: snapshot.source,
      sourceRecordId: snapshot.id,
    };
    const provenance = stripSecretFields({
      legacy: {
        metricSnapshotId: snapshot.id,
        daysSincePost: snapshot.daysSincePost,
        postUrl: snapshot.postUrl,
        fbRawResponse: snapshot.fbRawResponse,
        fetchedAt: snapshot.fetchedAt?.toISOString() ?? null,
      },
    });

    const observations: Array<{
      metricKey: string;
      valueKind: "NUMERIC" | "TEXT";
      numericValue?: number;
      textValue?: string;
    }> = [];
    for (const key of NUMERIC_METRICS) {
      const value = snapshot[key];
      if (value !== null) observations.push({ metricKey: key, valueKind: "NUMERIC", numericValue: value });
    }
    for (const [field, metricKey] of TEXT_METRICS) {
      const value = snapshot[field];
      if (value !== null) observations.push({ metricKey, valueKind: "TEXT", textValue: value });
    }

    for (const observation of observations) {
      const dedupeKey = metricDedupeKey([
        "metric-observation:v1",
        base.organizationId,
        base.brandId,
        `legacy-post:${snapshot.postId}`,
        observation.metricKey,
        snapshot.capturedAt.toISOString(),
        snapshot.source,
        snapshot.id,
      ]);
      const existing = await db.metricObservation.findUnique({
        where: { brandId_dedupeKey: { brandId: base.brandId, dedupeKey } },
      });
      if (existing) continue;
      await db.metricObservation.create({
        data: {
          id: stableId("mob", `${base.brandId}|${dedupeKey}`),
          ...base,
          ...observation,
          dedupeKey,
          provenance: provenance as Prisma.InputJsonValue,
        },
      });
      created.metricObservations += 1;
    }
  }
}

async function validateLegacyOwnership(
  db: P2Database,
  profiles: readonly { id: string; userIdentityId: string | null }[],
): Promise<void> {
  for (const [family, query] of LEGACY_RELATION_CHECKS) {
    const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(query);
    if (rows.length > 0) {
      throw new P2MigrationConflictError("MIGRATION_CROSS_TENANT_RELATION", family, rows[0].id);
    }
  }

  const unresolvedFocusPillar = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT w.id FROM WeeklyPlan w LEFT JOIN ContentPillar p ON p.id = w.focusPillarId WHERE w.focusPillarId IS NOT NULL AND p.id IS NULL ORDER BY w.id LIMIT 1`,
  );
  if (unresolvedFocusPillar.length > 0) {
    throw new P2MigrationConflictError(
      "MIGRATION_UNRESOLVED_RELATION",
      "WEEKLY_PLAN_FOCUS_PILLAR",
      unresolvedFocusPillar[0].id,
    );
  }

  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  for (const [table, family, ownerField] of DIRECT_SCOPE_TABLES) {
    const rows = await db.$queryRawUnsafe<Array<{
      id: string;
      ownerId: string | null;
      organizationId: string | null;
      brandId: string | null;
    }>>(
      `SELECT id, "${ownerField}" AS ownerId, organizationId, brandId FROM "${table}" ORDER BY id`,
    );
    for (const row of rows) {
      const hasOrganization = row.organizationId !== null;
      const hasBrand = row.brandId !== null;
      if (hasOrganization !== hasBrand) {
        throw new P2MigrationConflictError("MIGRATION_PARTIAL_SCOPE", family, row.id);
      }
      if (!hasOrganization) continue;

      const profile = row.ownerId ? profilesById.get(row.ownerId) : undefined;
      if (!profile) {
        throw new P2MigrationConflictError("MIGRATION_SCOPE_MISMATCH", family, row.id);
      }
      if (!profile.userIdentityId) {
        throw new P2MigrationConflictError("PARTIAL_MIGRATION_CONFLICT", family, row.id);
      }

      const expectedOrganizationId = stableId("org", `organization|${profile.userIdentityId}`);
      const expectedBrandId = stableId("brd", `brand|${profile.userIdentityId}`);
      if (row.organizationId !== expectedOrganizationId || row.brandId !== expectedBrandId) {
        throw new P2MigrationConflictError("MIGRATION_SCOPE_MISMATCH", family, row.id);
      }
    }
  }
}

export async function runP2Backfill(db: P2Database): Promise<P2BackfillReport> {
  const created: CreatedCounts = {
    userIdentities: 0,
    authIdentities: 0,
    organizations: 0,
    workspaces: 0,
    brands: 0,
    memberships: 0,
    metricObservations: 0,
  };
  const profiles = await db.userProfile.findMany({
    select: { id: true, name: true, userIdentityId: true },
    orderBy: { id: "asc" },
  });
  const appState = await db.appState.findUnique({ where: { id: "singleton" } });
  const subject = appState?.supabaseUserId?.trim() || null;

  await validateLegacyOwnership(db, profiles);

  for (const profile of profiles) {
    await ensureProfileGraph(db, profile, subject, created);
  }

  const promptRuns = await scopePromptRuns(db);
  await backfillMetricObservations(db, created);

  const profileIds = new Set(profiles.map((profile) => profile.id));
  const facebookRows = await db.facebookAccount.findMany({
    where: { brandId: null },
    select: { id: true, ownerRef: true },
  });
  const quarantinedFacebookAccounts = facebookRows
    .filter((row) => !profileIds.has(row.ownerRef))
    .map((row) => row.id)
    .sort();

  return {
    profilesProcessed: profiles.length,
    created,
    promptRuns,
    quarantinedFacebookAccounts,
  };
}
