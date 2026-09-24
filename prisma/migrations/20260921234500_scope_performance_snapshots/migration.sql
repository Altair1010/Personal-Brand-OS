ALTER TABLE "PerformanceSnapshot" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "PerformanceSnapshot" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "PerformanceSnapshot" ADD COLUMN "brandId" TEXT;
CREATE INDEX "PerformanceSnapshot_organizationId_brandId_entityType_capturedAt_idx"
ON "PerformanceSnapshot"("organizationId", "brandId", "entityType", "capturedAt");
