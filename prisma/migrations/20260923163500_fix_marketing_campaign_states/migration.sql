PRAGMA foreign_keys=OFF;

CREATE TABLE "new_MarketingCampaign" (
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
    "audienceIds" JSONB,
    "budget" JSONB,
    "channelIds" JSONB,
    "contentPlan" JSONB,
    "creativePlatform" JSONB,
    "experimentIds" JSONB,
    "imcPlanId" TEXT,
    "kpis" JSONB,
    CONSTRAINT "MarketingCampaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MarketingCampaign_workspaceId_organizationId_fkey" FOREIGN KEY ("workspaceId", "organizationId") REFERENCES "Workspace" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MarketingCampaign_brandId_workspaceId_organizationId_fkey" FOREIGN KEY ("brandId", "workspaceId", "organizationId") REFERENCES "Brand" ("id", "workspaceId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MarketingCampaign_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MarketingCampaign_channelMode_check" CHECK ("channelMode" IN ('ORGANIC','PAID','MIXED')),
    CONSTRAINT "MarketingCampaign_status_check" CHECK ("status" IN ('DRAFT','PLANNING','READY','ACTIVE','PAUSED','COMPLETED','ARCHIVED'))
);

INSERT INTO "new_MarketingCampaign" (
    "id","organizationId","workspaceId","brandId","strategyVersionId","name","objective","channelMode","status",
    "startsAt","endsAt","createdAt","updatedAt","audienceIds","budget","channelIds","contentPlan","creativePlatform",
    "experimentIds","imcPlanId","kpis"
)
SELECT
    "id","organizationId","workspaceId","brandId","strategyVersionId","name","objective","channelMode","status",
    "startsAt","endsAt","createdAt","updatedAt","audienceIds","budget","channelIds","contentPlan","creativePlatform",
    "experimentIds","imcPlanId","kpis"
FROM "MarketingCampaign";

DROP TABLE "MarketingCampaign";
ALTER TABLE "new_MarketingCampaign" RENAME TO "MarketingCampaign";

CREATE INDEX "MarketingCampaign_organizationId_workspaceId_brandId_status_idx"
ON "MarketingCampaign"("organizationId", "workspaceId", "brandId", "status");

CREATE INDEX "MarketingCampaign_strategyVersionId_idx"
ON "MarketingCampaign"("strategyVersionId");

PRAGMA foreign_keys=ON;
