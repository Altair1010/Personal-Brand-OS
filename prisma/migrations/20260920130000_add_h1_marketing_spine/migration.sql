-- CreateTable
CREATE TABLE "MarketingCampaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "strategyVersionId" TEXT,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "channelMode" TEXT NOT NULL DEFAULT 'MIXED',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MarketingCampaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MarketingCampaign_workspaceId_organizationId_fkey" FOREIGN KEY ("workspaceId", "organizationId") REFERENCES "Workspace" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MarketingCampaign_brandId_workspaceId_organizationId_fkey" FOREIGN KEY ("brandId", "workspaceId", "organizationId") REFERENCES "Brand" ("id", "workspaceId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MarketingCampaign_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MarketingCampaign_channelMode_check" CHECK ("channelMode" IN ('ORGANIC','PAID','MIXED')),
    CONSTRAINT "MarketingCampaign_status_check" CHECK ("status" IN ('DRAFT','ACTIVE','COMPLETED','ARCHIVED'))
);

-- CreateTable
CREATE TABLE "ContentDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "campaignId" TEXT,
    "postId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'ORGANIC',
    "provider" TEXT NOT NULL DEFAULT 'facebook',
    "state" TEXT NOT NULL DEFAULT 'APPROVED',
    "scheduledAt" DATETIME,
    "publishedAt" DATETIME,
    "externalRef" TEXT,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContentDelivery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ContentDelivery_workspaceId_organizationId_fkey" FOREIGN KEY ("workspaceId", "organizationId") REFERENCES "Workspace" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ContentDelivery_brandId_workspaceId_organizationId_fkey" FOREIGN KEY ("brandId", "workspaceId", "organizationId") REFERENCES "Brand" ("id", "workspaceId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ContentDelivery_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ContentDelivery_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContentDelivery_channel_check" CHECK ("channel" IN ('ORGANIC','PAID')),
    CONSTRAINT "ContentDelivery_state_check" CHECK ("state" IN ('APPROVED','SCHEDULED','EXTERNAL_NOT_CONNECTED','PUBLISHED','FAILED'))
);

-- CreateTable
CREATE TABLE "MetaAdsCampaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "marketingCampaignId" TEXT NOT NULL,
    "creativePostId" TEXT,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'DRAFT',
    "externalCampaignId" TEXT,
    "budgetMinor" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "targeting" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MetaAdsCampaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MetaAdsCampaign_workspaceId_organizationId_fkey" FOREIGN KEY ("workspaceId", "organizationId") REFERENCES "Workspace" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MetaAdsCampaign_brandId_workspaceId_organizationId_fkey" FOREIGN KEY ("brandId", "workspaceId", "organizationId") REFERENCES "Brand" ("id", "workspaceId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MetaAdsCampaign_marketingCampaignId_fkey" FOREIGN KEY ("marketingCampaignId") REFERENCES "MarketingCampaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MetaAdsCampaign_creativePostId_fkey" FOREIGN KEY ("creativePostId") REFERENCES "Post" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MetaAdsCampaign_state_check" CHECK ("state" IN ('DRAFT','READY','EXTERNAL_NOT_CONNECTED','SYNCED','PAUSED','COMPLETED')),
    CONSTRAINT "MetaAdsCampaign_budget_check" CHECK ("budgetMinor" IS NULL OR "budgetMinor" >= 0)
);

-- CreateTable
CREATE TABLE "MetaAdsMetricSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "metaAdsCampaignId" TEXT NOT NULL,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "spendMinor" INTEGER,
    "impressions" INTEGER,
    "reach" INTEGER,
    "clicks" INTEGER,
    "linkClicks" INTEGER,
    "conversions" REAL,
    "conversionValueMinor" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "evidence" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MetaAdsMetricSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MetaAdsMetricSnapshot_brandId_organizationId_fkey" FOREIGN KEY ("brandId", "organizationId") REFERENCES "Brand" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MetaAdsMetricSnapshot_metaAdsCampaignId_fkey" FOREIGN KEY ("metaAdsCampaignId") REFERENCES "MetaAdsCampaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MetaAdsMetricSnapshot_nonnegative_check" CHECK (
      ("spendMinor" IS NULL OR "spendMinor" >= 0) AND
      ("impressions" IS NULL OR "impressions" >= 0) AND
      ("reach" IS NULL OR "reach" >= 0) AND
      ("clicks" IS NULL OR "clicks" >= 0) AND
      ("linkClicks" IS NULL OR "linkClicks" >= 0) AND
      ("conversions" IS NULL OR "conversions" >= 0) AND
      ("conversionValueMinor" IS NULL OR "conversionValueMinor" >= 0)
    )
);

-- CreateIndex
CREATE INDEX "MarketingCampaign_organizationId_workspaceId_brandId_status_idx" ON "MarketingCampaign"("organizationId", "workspaceId", "brandId", "status");

-- CreateIndex
CREATE INDEX "MarketingCampaign_strategyVersionId_idx" ON "MarketingCampaign"("strategyVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentDelivery_postId_key" ON "ContentDelivery"("postId");

-- CreateIndex
CREATE INDEX "ContentDelivery_organizationId_workspaceId_brandId_state_idx" ON "ContentDelivery"("organizationId", "workspaceId", "brandId", "state");

-- CreateIndex
CREATE INDEX "ContentDelivery_campaignId_idx" ON "ContentDelivery"("campaignId");

-- CreateIndex
CREATE INDEX "MetaAdsCampaign_organizationId_workspaceId_brandId_state_idx" ON "MetaAdsCampaign"("organizationId", "workspaceId", "brandId", "state");

-- CreateIndex
CREATE INDEX "MetaAdsCampaign_marketingCampaignId_idx" ON "MetaAdsCampaign"("marketingCampaignId");

-- CreateIndex
CREATE INDEX "MetaAdsCampaign_externalCampaignId_idx" ON "MetaAdsCampaign"("externalCampaignId");

-- CreateIndex
CREATE INDEX "MetaAdsMetricSnapshot_organizationId_brandId_capturedAt_idx" ON "MetaAdsMetricSnapshot"("organizationId", "brandId", "capturedAt");

-- CreateIndex
CREATE INDEX "MetaAdsMetricSnapshot_metaAdsCampaignId_capturedAt_idx" ON "MetaAdsMetricSnapshot"("metaAdsCampaignId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MetaAdsMetricSnapshot_metaAdsCampaignId_capturedAt_source_key" ON "MetaAdsMetricSnapshot"("metaAdsCampaignId", "capturedAt", "source");
