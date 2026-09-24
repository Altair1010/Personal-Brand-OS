-- Reconcile schema changes that were previously introduced with db push during vNext development.
-- This migration is additive and intentionally avoids destructive legacy table rewrites.

ALTER TABLE "MarketingCampaign" ADD COLUMN "audienceIds" JSONB;
ALTER TABLE "MarketingCampaign" ADD COLUMN "budget" JSONB;
ALTER TABLE "MarketingCampaign" ADD COLUMN "channelIds" JSONB;
ALTER TABLE "MarketingCampaign" ADD COLUMN "contentPlan" JSONB;
ALTER TABLE "MarketingCampaign" ADD COLUMN "creativePlatform" JSONB;
ALTER TABLE "MarketingCampaign" ADD COLUMN "experimentIds" JSONB;
ALTER TABLE "MarketingCampaign" ADD COLUMN "imcPlanId" TEXT;
ALTER TABLE "MarketingCampaign" ADD COLUMN "kpis" JSONB;

ALTER TABLE "PromptTemplate" ADD COLUMN "supportedModels" JSONB;
ALTER TABLE "PromptTemplate" ADD COLUMN "evalSuite" JSONB;
ALTER TABLE "PromptTemplate" ADD COLUMN "lifecycleStatus" TEXT NOT NULL DEFAULT 'PRODUCTION';
ALTER TABLE "PromptTemplate" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "PromptTemplate" ADD COLUMN "changelog" TEXT;

ALTER TABLE "StrategyVersion" ADD COLUMN "structuredPlan" JSONB;
ALTER TABLE "StrategyVersion" ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "StrategyVersion" ADD COLUMN "approvedAt" DATETIME;

CREATE TABLE "IMCPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "strategyVersionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "objective" TEXT NOT NULL,
    "audienceSegments" JSONB NOT NULL,
    "strategicThesis" TEXT NOT NULL,
    "keyMessage" TEXT NOT NULL,
    "creativePlatform" JSONB NOT NULL,
    "funnelStages" JSONB NOT NULL,
    "channelPlans" JSONB NOT NULL,
    "campaigns" JSONB NOT NULL,
    "contentRequirements" JSONB NOT NULL,
    "budgetAllocation" JSONB,
    "kpis" JSONB NOT NULL,
    "experiments" JSONB,
    "measurementPlan" JSONB NOT NULL,
    "assumptions" JSONB,
    "risks" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "IMCPlan_strategyVersionId_version_key" ON "IMCPlan"("strategyVersionId", "version");
CREATE INDEX "IMCPlan_organizationId_workspaceId_brandId_status_idx" ON "IMCPlan"("organizationId", "workspaceId", "brandId", "status");

CREATE TABLE "KPIDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "supportedObjectives" JSONB NOT NULL,
    "defaultUnit" TEXT NOT NULL,
    "formula" TEXT,
    "aggregation" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "KPIDefinition_key_key" ON "KPIDefinition"("key");

CREATE TABLE "CopyTechnique" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "mechanism" TEXT NOT NULL,
    "triggerConditions" JSONB,
    "inputRequirements" JSONB,
    "steps" JSONB NOT NULL,
    "contraindications" JSONB,
    "evaluationRules" JSONB,
    "localeAdapters" JSONB,
    "provenance" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "CopyTechnique_name_key" ON "CopyTechnique"("name");

CREATE TABLE "VisualGrammar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "brandId" TEXT,
    "name" TEXT NOT NULL,
    "composition" JSONB NOT NULL,
    "palette" JSONB,
    "typography" JSONB,
    "propStrategy" JSONB,
    "humanPresence" JSONB,
    "visualMetaphor" JSONB,
    "brandConstraints" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "VisualGrammar_organizationId_brandId_status_idx" ON "VisualGrammar"("organizationId", "brandId", "status");

CREATE TABLE "AIVisibilitySnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "promptSet" JSONB NOT NULL,
    "brandMentions" JSONB NOT NULL,
    "sourceMentions" JSONB NOT NULL,
    "competitorMentions" JSONB NOT NULL,
    "citedPages" JSONB NOT NULL,
    "capturedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AIVisibilitySnapshot_organizationId_brandId_provider_capturedAt_idx" ON "AIVisibilitySnapshot"("organizationId", "brandId", "provider", "capturedAt");

CREATE TABLE "SEOAuditSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "extractorVersion" TEXT NOT NULL,
    "signals" JSONB NOT NULL,
    "findings" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "capturedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "SEOAuditSnapshot_organizationId_brandId_domain_capturedAt_idx" ON "SEOAuditSnapshot"("organizationId", "brandId", "domain", "capturedAt");

CREATE TABLE "SEOResearchArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "query" TEXT,
    "provider" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "evidenceRefs" JSONB,
    "capturedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "SEOResearchArtifact_organizationId_brandId_kind_capturedAt_idx" ON "SEOResearchArtifact"("organizationId", "brandId", "kind", "capturedAt");
