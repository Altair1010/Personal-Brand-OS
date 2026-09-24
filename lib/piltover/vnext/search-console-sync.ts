import { decryptString } from "@/lib/ai/keystore";
import type { PrismaClient } from "@prisma/client";
import { fetchSearchConsolePerformance } from "@/lib/piltover/providers/adapters/google-search-console";
import { captureEvidence } from "@/lib/piltover/vnext/evidence-service";
import { markSyncFailure, markSyncSuccess } from "@/lib/piltover/vnext/live-data-engine";
import { persistSeoResearch } from "@/lib/piltover/vnext/seo-engine";

export async function syncSearchConsoleResource(db: PrismaClient, input: {
  connectionId: string; resourceId: string; startDate: string; endDate: string;
}) {
  const resource = await db.providerResource.findUnique({
    where: { id: input.resourceId },
    include: { connection: true },
  });
  if (!resource || resource.connectionId !== input.connectionId) throw new Error("SEARCH_RESOURCE_NOT_FOUND");
  const connection = resource.connection;
  if (connection.provider !== "GOOGLE_SEARCH_CONSOLE") throw new Error("SEARCH_PROVIDER_INVALID");
  if (connection.status === "REVOKED" || connection.revokedAt) throw new Error("SEARCH_CONNECTION_REVOKED");
  if (!connection.credentialCiphertext) throw new Error("SEARCH_CREDENTIAL_MISSING");

  const syncScope = {
    organizationId: connection.organizationId, workspaceId: connection.workspaceId, brandId: connection.brandId,
    provider: connection.provider, connectionId: connection.id, resourceId: resource.id,
    dataset: "search-console-performance", cadenceMinutes: 1440,
  };
  try {
    const rows = await fetchSearchConsolePerformance(decryptString(connection.credentialCiphertext), {
      siteUrl: resource.externalId, startDate: input.startDate, endDate: input.endDate,
    });
    const artifact = await persistSeoResearch(db, {
      organizationId: connection.organizationId, brandId: connection.brandId, kind: "SEARCH_CONSOLE_PERFORMANCE",
      query: resource.externalId, provider: connection.provider,
      data: { siteUrl: resource.externalId, startDate: input.startDate, endDate: input.endDate, rows },
    });
    const evidence = await captureEvidence(db, {
      organizationId: connection.organizationId, brandId: connection.brandId,
      sourceType: "SEARCH_CONSOLE_PERFORMANCE", sourceRef: `seoResearch:${artifact.id}`,
      content: { siteUrl: resource.externalId, startDate: input.startDate, endDate: input.endDate, rowCount: rows.length },
      confidence: "provider-observed", freshness: "current",
      metadata: { connectionId: connection.id, resourceId: resource.id, provider: connection.provider },
    });
    await markSyncSuccess(db, {
      ...syncScope, windowStart: new Date(input.startDate + "T00:00:00Z"), windowEnd: new Date(input.endDate + "T23:59:59Z"),
    });
    return { artifact, evidence, rowCount: rows.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "SEARCH_SYNC_FAILED";
    await markSyncFailure(db, { ...syncScope, errorCode: "SEARCH_SYNC_FAILED", errorMessage: message });
    throw error;
  }
}
