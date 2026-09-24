-- H2.3 Live Data, Attribution & Search Intelligence
ALTER TABLE "PerformanceSnapshot" ADD COLUMN "provider" TEXT;
ALTER TABLE "PerformanceSnapshot" ADD COLUMN "providerAccountRef" TEXT;
ALTER TABLE "PerformanceSnapshot" ADD COLUMN "providerResourceRef" TEXT;
ALTER TABLE "PerformanceSnapshot" ADD COLUMN "providerEntityRef" TEXT;
ALTER TABLE "PerformanceSnapshot" ADD COLUMN "provenance" JSONB;
ALTER TABLE "PerformanceSnapshot" ADD COLUMN "lineage" JSONB;
ALTER TABLE "PerformanceSnapshot" ADD COLUMN "attributionStatus" TEXT NOT NULL DEFAULT 'UNLINKED';

CREATE INDEX "PerformanceSnapshot_provider_providerAccountRef_providerEntityRef_capturedAt_idx"
ON "PerformanceSnapshot"("provider", "providerAccountRef", "providerEntityRef", "capturedAt");

CREATE TABLE "ProviderMetricObservation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "workspaceId" TEXT,
  "brandId" TEXT,
  "provider" TEXT NOT NULL,
  "providerAccountRef" TEXT NOT NULL,
  "providerResourceRef" TEXT,
  "providerEntityRef" TEXT NOT NULL,
  "metricKey" TEXT NOT NULL,
  "numericValue" REAL NOT NULL,
  "period" TEXT NOT NULL,
  "observedAt" DATETIME NOT NULL,
  "sourceFingerprint" TEXT NOT NULL,
  "raw" JSONB,
  "performanceSnapshotId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ProviderMetricObservation_sourceFingerprint_key" ON "ProviderMetricObservation"("sourceFingerprint");
CREATE INDEX "ProviderMetricObservation_organizationId_brandId_provider_providerEntityRef_observedAt_idx"
ON "ProviderMetricObservation"("organizationId", "brandId", "provider", "providerEntityRef", "observedAt");
CREATE INDEX "ProviderMetricObservation_performanceSnapshotId_idx" ON "ProviderMetricObservation"("performanceSnapshotId");

CREATE TABLE "DataSyncState" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "workspaceId" TEXT,
  "brandId" TEXT NOT NULL DEFAULT '',
  "provider" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL DEFAULT '',
  "resourceId" TEXT NOT NULL DEFAULT '',
  "dataset" TEXT NOT NULL,
  "cadenceMinutes" INTEGER NOT NULL DEFAULT 1440,
  "status" TEXT NOT NULL DEFAULT 'NEVER_SYNCED',
  "lastAttemptAt" DATETIME,
  "lastSuccessfulAt" DATETIME,
  "expectedNextAt" DATETIME,
  "windowStart" DATETIME,
  "windowEnd" DATETIME,
  "missingWindows" JSONB,
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "DataSyncState_scope_key" ON "DataSyncState"("organizationId", "brandId", "provider", "connectionId", "resourceId", "dataset");
CREATE INDEX "DataSyncState_organizationId_brandId_status_expectedNextAt_idx" ON "DataSyncState"("organizationId", "brandId", "status", "expectedNextAt");
