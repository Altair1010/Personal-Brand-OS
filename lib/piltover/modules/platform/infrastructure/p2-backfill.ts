import { createHash, randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

type P2Database = PrismaClient;

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
        where: { userId: profile.id },
        data: { organizationId, brandId },
      });
    }
    await tx.contentTemplate.updateMany({
      where: { userId: profile.id },
      data: { organizationId, brandId },
    });
    await tx.framework.updateMany({
      where: { userId: profile.id },
      data: { organizationId, brandId },
    });
    await tx.facebookAccount.updateMany({
      where: { ownerRef: profile.id },
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

async function validateLegacyOwnership(db: P2Database): Promise<void> {
  const checks = [
    `SELECT s.id FROM Strategy s JOIN Goal g ON g.id = s.goalId WHERE s.userId <> g.userId LIMIT 1`,
    `SELECT i.id FROM ContentIdea i JOIN ContentPillar p ON p.id = i.pillarId WHERE i.userId <> p.userId LIMIT 1`,
    `SELECT d.id FROM ContentDraft d JOIN ContentPillar p ON p.id = d.pillarId WHERE d.userId <> p.userId LIMIT 1`,
    `SELECT d.id FROM ContentDraft d JOIN ContentIdea i ON i.id = d.contentIdeaId WHERE d.userId <> i.userId LIMIT 1`,
    `SELECT p.id FROM Post p JOIN ContentDraft d ON d.id = p.contentDraftId WHERE p.userId <> d.userId LIMIT 1`,
    `SELECT p.id FROM Post p JOIN ContentPillar cp ON cp.id = p.pillarId WHERE p.userId <> cp.userId LIMIT 1`,
    `SELECT p.id FROM Post p JOIN StrategyVersion sv ON sv.id = p.strategyVersionId JOIN Strategy s ON s.id = sv.strategyId WHERE p.userId <> s.userId LIMIT 1`,
  ];
  for (const query of checks) {
    const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(query);
    if (rows.length > 0) throw new Error(`MIGRATION_CROSS_USER_RELATION:${rows[0].id}`);
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

  await validateLegacyOwnership(db);

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
