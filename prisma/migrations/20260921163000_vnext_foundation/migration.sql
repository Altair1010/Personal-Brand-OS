-- AlterTable
ALTER TABLE "ContentDraft" ADD COLUMN "description" TEXT;
ALTER TABLE "ContentDraft" ADD COLUMN "notes" TEXT;

-- Expand existing agent registry without replacing the current control plane.
ALTER TABLE "AgentDefinition" ADD COLUMN "description" TEXT;
ALTER TABLE "AgentDefinition" ADD COLUMN "domain" TEXT;
ALTER TABLE "AgentDefinition" ADD COLUMN "currentVersionId" TEXT;
ALTER TABLE "AgentDefinition" ADD COLUMN "modelPolicy" JSONB;
ALTER TABLE "AgentDefinition" ADD COLUMN "memoryPolicy" JSONB;
ALTER TABLE "AgentDefinition" ADD COLUMN "toolPolicy" JSONB;
ALTER TABLE "AgentDefinition" ADD COLUMN "approvalPolicy" JSONB;
ALTER TABLE "AgentDefinition" ADD COLUMN "outputSchemaRef" TEXT;
ALTER TABLE "AgentDefinition" ADD COLUMN "evaluationSuiteRef" TEXT;

-- CreateTable
CREATE TABLE "AgentThread" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "brandId" TEXT,
    "projectId" TEXT,
    "agentDefinitionId" TEXT,
    "agentVersionId" TEXT,
    "state" JSONB,
    "memoryRefs" JSONB,
    "artifactRefs" JSONB,
    "participants" JSONB,
    "activeCheckpointId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AgentCheckpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threadId" TEXT NOT NULL,
    "runId" TEXT,
    "sequence" INTEGER NOT NULL,
    "stateSnapshot" JSONB NOT NULL,
    "pendingActions" JSONB,
    "pendingApprovals" JSONB,
    "summary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentCheckpoint_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "AgentThread" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentCheckpoint_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threadId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fileRef" TEXT NOT NULL,
    "previewRef" TEXT,
    "extractedTextRef" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatAttachment_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "AgentThread" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PromptDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "domain" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PromptVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "promptId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "system" TEXT NOT NULL,
    "instructions" TEXT,
    "templateVariables" JSONB,
    "inputSchema" JSONB,
    "outputSchema" JSONB,
    "supportedModels" JSONB,
    "evalSuite" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromptVersion_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "PromptDefinition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SkillDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SkillVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "skillId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "inputSchemaRef" TEXT,
    "outputSchemaRef" TEXT,
    "promptRef" TEXT,
    "deterministicSteps" JSONB,
    "llmSteps" JSONB,
    "tools" JSONB,
    "evaluators" JSONB,
    "qualityGates" JSONB,
    "provenance" JSONB,
    "tests" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SkillVersion_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "SkillDefinition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketingProjectContext" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "brand" JSONB NOT NULL,
    "offerings" JSONB NOT NULL,
    "audiences" JSONB NOT NULL,
    "competitors" JSONB NOT NULL,
    "objectives" JSONB NOT NULL,
    "funnel" JSONB,
    "channels" JSONB NOT NULL,
    "campaign" JSONB,
    "seo" JSONB,
    "measurement" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "brandId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceRef" TEXT,
    "content" JSONB NOT NULL,
    "confidence" TEXT,
    "freshness" TEXT,
    "metadata" JSONB,
    "capturedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ToolGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "brandId" TEXT,
    "agentDefinitionId" TEXT,
    "toolNamespace" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceScope" JSONB,
    "canRead" BOOLEAN NOT NULL DEFAULT true,
    "canWrite" BOOLEAN NOT NULL DEFAULT false,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
    "rateLimit" JSONB,
    "maxActionsPerRun" INTEGER,
    "credentialRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ImportedPattern" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceRepo" TEXT NOT NULL,
    "sourceVersion" TEXT,
    "sourcePath" TEXT,
    "license" TEXT,
    "importedAs" TEXT NOT NULL,
    "adaptation" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ContentBrief" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "campaignId" TEXT,
    "objective" TEXT NOT NULL,
    "audienceRef" TEXT,
    "keyMessage" TEXT,
    "offer" TEXT,
    "format" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "tone" TEXT,
    "intensity" TEXT,
    "hookDirection" TEXT,
    "length" TEXT,
    "cta" TEXT,
    "evidenceRefs" JSONB,
    "requiredPoints" JSONB,
    "forbiddenPoints" JSONB,
    "references" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CreativeTerritory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentBriefId" TEXT NOT NULL,
    "insight" TEXT NOT NULL,
    "tension" TEXT,
    "promise" TEXT,
    "emotionalDirection" TEXT,
    "semanticConnection" TEXT,
    "visualMetaphor" TEXT,
    "tone" TEXT,
    "noveltyScore" REAL,
    "brandFitScore" REAL,
    "mechanism" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ContentConcept" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentBriefId" TEXT NOT NULL,
    "creativeTerritoryId" TEXT,
    "title" TEXT NOT NULL,
    "concept" JSONB NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ContentMaster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "contentBriefId" TEXT NOT NULL,
    "conceptId" TEXT,
    "schemaType" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ChannelVariant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentMasterId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "QualityGate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "artifactType" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "evaluator" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "scores" JSONB,
    "status" TEXT NOT NULL,
    "evidence" JSONB,
    "recommendations" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PublishingJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "contentVariantId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "scheduledAt" DATETIME,
    "providerPayload" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "providerPostId" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "MetricDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "formula" TEXT,
    "unit" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "aggregation" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PerformanceSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "metrics" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "capturedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Experiment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "control" JSONB,
    "variants" JSONB NOT NULL,
    "primaryMetric" TEXT NOT NULL,
    "secondaryMetrics" JSONB,
    "startAt" DATETIME,
    "endAt" DATETIME,
    "sample" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "analysis" JSONB,
    "conclusion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "evidenceRefs" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AgentRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "brandId" TEXT,
    "threadId" TEXT,
    "agentVersionId" TEXT,
    "promptVersionId" TEXT,
    "skillVersionRefs" JSONB,
    "modelRef" TEXT,
    "tokenUsage" JSONB,
    "costMinor" INTEGER,
    "traceId" TEXT,
    "startedAt" DATETIME,
    "schemaVersion" TEXT NOT NULL DEFAULT '1.0',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "roleRef" TEXT NOT NULL,
    "task" JSONB NOT NULL,
    "contextRef" JSONB NOT NULL,
    "permissionManifestRef" TEXT NOT NULL,
    "requiredCapabilities" JSONB NOT NULL,
    "idempotencyKey" TEXT,
    "requestFingerprint" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "terminalResult" JSONB,
    "terminalFingerprint" TEXT,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentRun_workspaceId_organizationId_fkey" FOREIGN KEY ("workspaceId", "organizationId") REFERENCES "Workspace" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentRun_brandId_workspaceId_organizationId_fkey" FOREIGN KEY ("brandId", "workspaceId", "organizationId") REFERENCES "Brand" ("id", "workspaceId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentRun_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "AgentThread" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AgentRun" ("brandId", "completedAt", "contextRef", "correlationId", "createdAt", "id", "idempotencyKey", "organizationId", "permissionManifestRef", "requestFingerprint", "requiredCapabilities", "roleRef", "schemaVersion", "status", "task", "terminalFingerprint", "terminalResult", "updatedAt", "workspaceId") SELECT "brandId", "completedAt", "contextRef", "correlationId", "createdAt", "id", "idempotencyKey", "organizationId", "permissionManifestRef", "requestFingerprint", "requiredCapabilities", "roleRef", "schemaVersion", "status", "task", "terminalFingerprint", "terminalResult", "updatedAt", "workspaceId" FROM "AgentRun";
DROP TABLE "AgentRun";
ALTER TABLE "new_AgentRun" RENAME TO "AgentRun";
CREATE INDEX "AgentRun_organizationId_workspaceId_brandId_status_idx" ON "AgentRun"("organizationId", "workspaceId", "brandId", "status");
CREATE UNIQUE INDEX "AgentRun_id_organizationId_key" ON "AgentRun"("id", "organizationId");
CREATE UNIQUE INDEX "AgentRun_organizationId_idempotencyKey_key" ON "AgentRun"("organizationId", "idempotencyKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AgentThread_organizationId_workspaceId_brandId_status_idx" ON "AgentThread"("organizationId", "workspaceId", "brandId", "status");

-- CreateIndex
CREATE INDEX "AgentCheckpoint_threadId_createdAt_idx" ON "AgentCheckpoint"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentCheckpoint_runId_idx" ON "AgentCheckpoint"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentCheckpoint_threadId_sequence_key" ON "AgentCheckpoint"("threadId", "sequence");

-- CreateIndex
CREATE INDEX "ChatAttachment_threadId_createdAt_idx" ON "ChatAttachment"("threadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PromptDefinition_key_key" ON "PromptDefinition"("key");

-- CreateIndex
CREATE INDEX "PromptVersion_promptId_status_version_idx" ON "PromptVersion"("promptId", "status", "version");

-- CreateIndex
CREATE UNIQUE INDEX "PromptVersion_promptId_version_key" ON "PromptVersion"("promptId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "SkillDefinition_key_key" ON "SkillDefinition"("key");

-- CreateIndex
CREATE INDEX "SkillVersion_skillId_status_version_idx" ON "SkillVersion"("skillId", "status", "version");

-- CreateIndex
CREATE UNIQUE INDEX "SkillVersion_skillId_version_key" ON "SkillVersion"("skillId", "version");

-- CreateIndex
CREATE INDEX "MarketingProjectContext_organizationId_workspaceId_brandId_status_idx" ON "MarketingProjectContext"("organizationId", "workspaceId", "brandId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingProjectContext_brandId_version_key" ON "MarketingProjectContext"("brandId", "version");

-- CreateIndex
CREATE INDEX "Evidence_organizationId_brandId_sourceType_capturedAt_idx" ON "Evidence"("organizationId", "brandId", "sourceType", "capturedAt");

-- CreateIndex
CREATE INDEX "ToolGrant_organizationId_workspaceId_brandId_agentDefinitionId_status_idx" ON "ToolGrant"("organizationId", "workspaceId", "brandId", "agentDefinitionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ToolGrant_organizationId_agentDefinitionId_toolNamespace_action_key" ON "ToolGrant"("organizationId", "agentDefinitionId", "toolNamespace", "action");

-- CreateIndex
CREATE INDEX "ContentBrief_organizationId_workspaceId_brandId_campaignId_idx" ON "ContentBrief"("organizationId", "workspaceId", "brandId", "campaignId");

-- CreateIndex
CREATE INDEX "CreativeTerritory_contentBriefId_createdAt_idx" ON "CreativeTerritory"("contentBriefId", "createdAt");

-- CreateIndex
CREATE INDEX "ContentConcept_contentBriefId_creativeTerritoryId_idx" ON "ContentConcept"("contentBriefId", "creativeTerritoryId");

-- CreateIndex
CREATE INDEX "ContentMaster_organizationId_brandId_status_idx" ON "ContentMaster"("organizationId", "brandId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ContentMaster_contentBriefId_version_key" ON "ContentMaster"("contentBriefId", "version");

-- CreateIndex
CREATE INDEX "ChannelVariant_contentMasterId_channel_status_idx" ON "ChannelVariant"("contentMasterId", "channel", "status");

-- CreateIndex
CREATE INDEX "QualityGate_artifactType_artifactId_status_idx" ON "QualityGate"("artifactType", "artifactId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PublishingJob_idempotencyKey_key" ON "PublishingJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PublishingJob_organizationId_brandId_status_scheduledAt_idx" ON "PublishingJob"("organizationId", "brandId", "status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "MetricDefinition_key_key" ON "MetricDefinition"("key");

-- CreateIndex
CREATE INDEX "PerformanceSnapshot_entityType_entityId_capturedAt_idx" ON "PerformanceSnapshot"("entityType", "entityId", "capturedAt");

-- CreateIndex
CREATE INDEX "Experiment_organizationId_brandId_status_idx" ON "Experiment"("organizationId", "brandId", "status");

-- CreateIndex
CREATE INDEX "Recommendation_organizationId_brandId_status_idx" ON "Recommendation"("organizationId", "brandId", "status");


-- Approval payload snapshots are required for durable HITL resume.
ALTER TABLE "ApprovalRequest" ADD COLUMN "payloadSnapshot" JSONB;
ALTER TABLE "ApprovalRequest" ADD COLUMN "decision" TEXT;
ALTER TABLE "ApprovalRequest" ADD COLUMN "comment" TEXT;
