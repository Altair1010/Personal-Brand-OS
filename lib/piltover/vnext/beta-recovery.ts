import type { PrismaClient } from "@prisma/client";
import type { TenantScope } from "@/lib/piltover/vnext/governance-service";
import { validateTenantScope } from "@/lib/piltover/vnext/governance-service";

export const BETA_RECOVERY_VERSION = 1;

export async function exportBetaRecovery(db: PrismaClient, scope: TenantScope) {
  await validateTenantScope(db, scope);
  const where = { organizationId: scope.organizationId, brandId: scope.brandId };
  const [brand, contexts, connections, resources, campaigns, briefs, masters, variants, snapshots, evidence, recommendations, syncStates, jobs] = await Promise.all([
    db.brand.findUniqueOrThrow({ where: { id: scope.brandId } }),
    db.marketingProjectContext.findMany({ where: { ...where, workspaceId: scope.workspaceId } }),
    db.providerConnection.findMany({ where: { ...where, workspaceId: scope.workspaceId } }),
    db.providerResource.findMany({ where: { connection: { organizationId: scope.organizationId, workspaceId: scope.workspaceId, brandId: scope.brandId } } }),
    db.marketingCampaign.findMany({ where }),
    db.contentBrief.findMany({ where: { ...where, workspaceId: scope.workspaceId } }),
    db.contentMaster.findMany({ where }),
    Promise.resolve([]),
    db.performanceSnapshot.findMany({ where }),
    db.evidence.findMany({ where }),
    db.recommendation.findMany({ where }),
    db.dataSyncState.findMany({ where }),
    db.publishingJob.findMany({ where }),
  ]);
  return {
    version: BETA_RECOVERY_VERSION,
    exportedAt: new Date().toISOString(),
    scope,
    safety: {
      rawProviderSecretsIncluded: false,
      historicalExternalJobsReplayable: false,
      restorePolicy: "METADATA_AND_PROJECT_STATE_ONLY",
    },
    data: {
      brand,
      contexts,
      connections: connections.map((connection) => {
        const { credentialCiphertext: credential, refreshTokenCiphertext: refresh, ...row } = connection;
        return { ...row, credentialPresent: Boolean(credential), refreshCredentialPresent: Boolean(refresh) };
      }),
      resources, campaigns, briefs, masters, variants, snapshots, evidence, recommendations, syncStates,
      historicalPublishingJobs: jobs.map((job) => ({
        id: job.id, status: job.status, providerPostId: job.providerPostId, completedAt: job.completedAt,
        scheduledAt: job.scheduledAt, replayable: false,
      })),
    },
  };
}

export function assertSafeBetaRecoveryEnvelope(envelope: unknown) {
  if (!envelope || typeof envelope !== "object") throw new Error("RECOVERY_ENVELOPE_INVALID");
  const value = envelope as Record<string, unknown>;
  if (value.version !== BETA_RECOVERY_VERSION) throw new Error("RECOVERY_VERSION_UNSUPPORTED");
  const safety = value.safety as Record<string, unknown> | undefined;
  if (!safety || safety.rawProviderSecretsIncluded !== false || safety.historicalExternalJobsReplayable !== false) {
    throw new Error("RECOVERY_SAFETY_INVARIANT_FAILED");
  }
  return value;
}
