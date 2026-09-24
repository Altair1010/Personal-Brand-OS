-- CreateTable
CREATE TABLE "AdCampaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "goalId" TEXT,
    "strategyId" TEXT,
    "creativeDraftId" TEXT,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "audience" JSONB,
    "budgetAmount" REAL,
    "budgetCurrency" TEXT NOT NULL DEFAULT 'VND',
    "bidIntent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "deliveryMode" TEXT NOT NULL DEFAULT 'INTERNAL_DEMO',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdCampaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AdCampaign_brandId_organizationId_fkey" FOREIGN KEY ("brandId", "organizationId") REFERENCES "Brand" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdMetricObservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "numericValue" REAL NOT NULL,
    "observedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "provenance" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdMetricObservation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AdMetricObservation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AdMetricObservation_brandId_organizationId_fkey" FOREIGN KEY ("brandId", "organizationId") REFERENCES "Brand" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AdCampaign_organizationId_brandId_status_idx" ON "AdCampaign"("organizationId", "brandId", "status");

-- CreateIndex
CREATE INDEX "AdCampaign_goalId_idx" ON "AdCampaign"("goalId");

-- CreateIndex
CREATE INDEX "AdCampaign_strategyId_idx" ON "AdCampaign"("strategyId");

-- CreateIndex
CREATE INDEX "AdCampaign_creativeDraftId_idx" ON "AdCampaign"("creativeDraftId");

-- CreateIndex
CREATE INDEX "AdMetricObservation_organizationId_brandId_metricKey_observedAt_idx" ON "AdMetricObservation"("organizationId", "brandId", "metricKey", "observedAt");

-- CreateIndex
CREATE INDEX "AdMetricObservation_campaignId_observedAt_idx" ON "AdMetricObservation"("campaignId", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdMetricObservation_campaignId_metricKey_observedAt_key" ON "AdMetricObservation"("campaignId", "metricKey", "observedAt");
