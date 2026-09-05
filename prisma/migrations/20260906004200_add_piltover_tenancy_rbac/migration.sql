-- CreateTable
CREATE TABLE "UserIdentity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserIdentity_status_check" CHECK ("status" IN ('ACTIVE', 'DISABLED'))
);

-- CreateTable
CREATE TABLE "AuthIdentity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userIdentityId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuthIdentity_userIdentityId_fkey" FOREIGN KEY ("userIdentityId") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Organization_lifecycle_check" CHECK (
        ("status" = 'ACTIVE' AND "archivedAt" IS NULL) OR
        ("status" = 'ARCHIVED' AND "archivedAt" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userIdentityId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "organizationRole" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Membership_userIdentityId_fkey" FOREIGN KEY ("userIdentityId") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Membership_status_check" CHECK ("status" IN ('ACTIVE', 'SUSPENDED', 'REVOKED')),
    CONSTRAINT "Membership_role_check" CHECK ("organizationRole" IS NULL OR "organizationRole" IN ('OWNER', 'ADMIN', 'MANAGER', 'EDITOR', 'VIEWER', 'APPROVER', 'AGENT_OPERATOR'))
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Workspace_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Workspace_lifecycle_check" CHECK (
        ("status" = 'ACTIVE' AND "archivedAt" IS NULL) OR
        ("status" = 'ARCHIVED' AND "archivedAt" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "WorkspaceRoleBinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "membershipId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkspaceRoleBinding_membershipId_organizationId_fkey" FOREIGN KEY ("membershipId", "organizationId") REFERENCES "Membership" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkspaceRoleBinding_workspaceId_organizationId_fkey" FOREIGN KEY ("workspaceId", "organizationId") REFERENCES "Workspace" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkspaceRoleBinding_status_check" CHECK ("status" IN ('ACTIVE', 'REVOKED')),
    CONSTRAINT "WorkspaceRoleBinding_role_check" CHECK ("role" IN ('ADMIN', 'MANAGER', 'EDITOR', 'VIEWER', 'APPROVER', 'AGENT_OPERATOR'))
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Brand_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Brand_workspaceId_organizationId_fkey" FOREIGN KEY ("workspaceId", "organizationId") REFERENCES "Workspace" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Brand_lifecycle_check" CHECK (
        ("status" = 'ACTIVE' AND "archivedAt" IS NULL) OR
        ("status" = 'ARCHIVED' AND "archivedAt" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "BrandRoleBinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "membershipId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BrandRoleBinding_membershipId_organizationId_fkey" FOREIGN KEY ("membershipId", "organizationId") REFERENCES "Membership" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BrandRoleBinding_brandId_workspaceId_organizationId_fkey" FOREIGN KEY ("brandId", "workspaceId", "organizationId") REFERENCES "Brand" ("id", "workspaceId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BrandRoleBinding_status_check" CHECK ("status" IN ('ACTIVE', 'REVOKED')),
    CONSTRAINT "BrandRoleBinding_role_check" CHECK ("role" IN ('ADMIN', 'MANAGER', 'EDITOR', 'VIEWER', 'APPROVER', 'AGENT_OPERATOR'))
);

-- CreateTable
CREATE TABLE "MetricObservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "legacyPostId" TEXT,
    "metricKey" TEXT NOT NULL,
    "valueKind" TEXT NOT NULL,
    "numericValue" REAL,
    "textValue" TEXT,
    "observedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "provenance" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MetricObservation_brandId_organizationId_fkey" FOREIGN KEY ("brandId", "organizationId") REFERENCES "Brand" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MetricObservation_legacyPostId_fkey" FOREIGN KEY ("legacyPostId") REFERENCES "Post" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MetricObservation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MetricObservation_typed_value_check" CHECK (
        ("valueKind" = 'NUMERIC' AND "numericValue" IS NOT NULL AND "textValue" IS NULL) OR
        ("valueKind" = 'TEXT' AND "numericValue" IS NULL AND "textValue" IS NOT NULL)
    )
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AudienceSegment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "brandId" TEXT,
    "goalId" TEXT,
    "name" TEXT NOT NULL,
    "pain" TEXT,
    "falseBelief" TEXT,
    "fear" TEXT,
    "desire" TEXT,
    "language" TEXT,
    "contentAngle" TEXT,
    "cta" TEXT,
    "offer" TEXT,
    "source" TEXT NOT NULL DEFAULT 'ai',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AudienceSegment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AudienceSegment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AudienceSegment_brandId_organizationId_fkey" FOREIGN KEY ("brandId", "organizationId") REFERENCES "Brand" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AudienceSegment_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AudienceSegment" ("contentAngle", "createdAt", "cta", "desire", "falseBelief", "fear", "goalId", "id", "language", "name", "offer", "pain", "source", "updatedAt", "userId") SELECT "contentAngle", "createdAt", "cta", "desire", "falseBelief", "fear", "goalId", "id", "language", "name", "offer", "pain", "source", "updatedAt", "userId" FROM "AudienceSegment";
DROP TABLE "AudienceSegment";
ALTER TABLE "new_AudienceSegment" RENAME TO "AudienceSegment";
CREATE INDEX "AudienceSegment_userId_idx" ON "AudienceSegment"("userId");
CREATE INDEX "AudienceSegment_organizationId_brandId_idx" ON "AudienceSegment"("organizationId", "brandId");
CREATE TABLE "new_BrandDNA" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "brandId" TEXT,
    "whoAmI" TEXT,
    "field" TEXT,
    "threeWords" JSONB,
    "coreBeliefs" TEXT,
    "differentiation" TEXT,
    "personalStory" TEXT,
    "expertise" TEXT,
    "customerProfile" TEXT,
    "customerPain" TEXT,
    "customerMisunderstanding" TEXT,
    "marketEducationGoal" TEXT,
    "companyName" TEXT,
    "offers" JSONB,
    "usp" TEXT,
    "region" TEXT,
    "sourceFiles" JSONB,
    "aiPositioning" TEXT,
    "aiSuggestions" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BrandDNA_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BrandDNA_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BrandDNA_brandId_organizationId_fkey" FOREIGN KEY ("brandId", "organizationId") REFERENCES "Brand" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_BrandDNA" ("aiPositioning", "aiSuggestions", "companyName", "coreBeliefs", "createdAt", "customerMisunderstanding", "customerPain", "customerProfile", "differentiation", "expertise", "field", "id", "marketEducationGoal", "offers", "personalStory", "region", "sourceFiles", "threeWords", "updatedAt", "userId", "usp", "version", "whoAmI") SELECT "aiPositioning", "aiSuggestions", "companyName", "coreBeliefs", "createdAt", "customerMisunderstanding", "customerPain", "customerProfile", "differentiation", "expertise", "field", "id", "marketEducationGoal", "offers", "personalStory", "region", "sourceFiles", "threeWords", "updatedAt", "userId", "usp", "version", "whoAmI" FROM "BrandDNA";
DROP TABLE "BrandDNA";
ALTER TABLE "new_BrandDNA" RENAME TO "BrandDNA";
CREATE UNIQUE INDEX "BrandDNA_userId_key" ON "BrandDNA"("userId");
CREATE UNIQUE INDEX "BrandDNA_brandId_key" ON "BrandDNA"("brandId");
CREATE INDEX "BrandDNA_organizationId_brandId_idx" ON "BrandDNA"("organizationId", "brandId");
CREATE TABLE "new_ContentDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentIdeaId" TEXT,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "brandId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "objectiveKey" TEXT,
    "pillarId" TEXT,
    "framework" TEXT,
    "tone" TEXT,
    "length" TEXT,
    "hookStyle" TEXT,
    "ctaIntensity" TEXT,
    "format" TEXT,
    "topic" TEXT,
    "hook" TEXT,
    "body" TEXT,
    "ending" TEXT,
    "hashtags" JSONB,
    "imageSuggestion" TEXT,
    "contentMarkdown" TEXT,
    "aiPromptRunId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContentDraft_contentIdeaId_fkey" FOREIGN KEY ("contentIdeaId") REFERENCES "ContentIdea" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ContentDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContentDraft_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ContentDraft_brandId_organizationId_fkey" FOREIGN KEY ("brandId", "organizationId") REFERENCES "Brand" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ContentDraft_pillarId_fkey" FOREIGN KEY ("pillarId") REFERENCES "ContentPillar" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ContentDraft_aiPromptRunId_fkey" FOREIGN KEY ("aiPromptRunId") REFERENCES "PromptRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ContentDraft" ("aiPromptRunId", "body", "contentIdeaId", "contentMarkdown", "createdAt", "ctaIntensity", "ending", "format", "framework", "hashtags", "hook", "hookStyle", "id", "imageSuggestion", "length", "objectiveKey", "pillarId", "status", "tone", "topic", "updatedAt", "userId", "version") SELECT "aiPromptRunId", "body", "contentIdeaId", "contentMarkdown", "createdAt", "ctaIntensity", "ending", "format", "framework", "hashtags", "hook", "hookStyle", "id", "imageSuggestion", "length", "objectiveKey", "pillarId", "status", "tone", "topic", "updatedAt", "userId", "version" FROM "ContentDraft";
DROP TABLE "ContentDraft";
ALTER TABLE "new_ContentDraft" RENAME TO "ContentDraft";
CREATE INDEX "ContentDraft_organizationId_brandId_idx" ON "ContentDraft"("organizationId", "brandId");
CREATE TABLE "new_ContentIdea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dailyPlanId" TEXT,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "brandId" TEXT,
    "title" TEXT NOT NULL,
    "objectiveKey" TEXT,
    "pillarId" TEXT,
    "angle" TEXT,
    "hookSeed" TEXT,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'ai',
    "status" TEXT NOT NULL DEFAULT 'idea',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContentIdea_dailyPlanId_fkey" FOREIGN KEY ("dailyPlanId") REFERENCES "DailyPlan" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ContentIdea_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContentIdea_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ContentIdea_brandId_organizationId_fkey" FOREIGN KEY ("brandId", "organizationId") REFERENCES "Brand" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ContentIdea_pillarId_fkey" FOREIGN KEY ("pillarId") REFERENCES "ContentPillar" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ContentIdea" ("angle", "createdAt", "dailyPlanId", "hookSeed", "id", "notes", "objectiveKey", "pillarId", "source", "status", "title", "updatedAt", "userId") SELECT "angle", "createdAt", "dailyPlanId", "hookSeed", "id", "notes", "objectiveKey", "pillarId", "source", "status", "title", "updatedAt", "userId" FROM "ContentIdea";
DROP TABLE "ContentIdea";
ALTER TABLE "new_ContentIdea" RENAME TO "ContentIdea";
CREATE INDEX "ContentIdea_userId_status_idx" ON "ContentIdea"("userId", "status");
CREATE INDEX "ContentIdea_organizationId_brandId_idx" ON "ContentIdea"("organizationId", "brandId");
CREATE TABLE "new_ContentPillar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "brandId" TEXT,
    "goalId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ratioPercent" INTEGER NOT NULL DEFAULT 0,
    "objectiveMix" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContentPillar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContentPillar_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ContentPillar_brandId_organizationId_fkey" FOREIGN KEY ("brandId", "organizationId") REFERENCES "Brand" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ContentPillar_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ContentPillar" ("createdAt", "description", "goalId", "id", "name", "objectiveMix", "ratioPercent", "status", "updatedAt", "userId") SELECT "createdAt", "description", "goalId", "id", "name", "objectiveMix", "ratioPercent", "status", "updatedAt", "userId" FROM "ContentPillar";
DROP TABLE "ContentPillar";
ALTER TABLE "new_ContentPillar" RENAME TO "ContentPillar";
CREATE INDEX "ContentPillar_userId_idx" ON "ContentPillar"("userId");
CREATE INDEX "ContentPillar_organizationId_brandId_idx" ON "ContentPillar"("organizationId", "brandId");
CREATE TABLE "new_ContentTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "organizationId" TEXT,
    "brandId" TEXT,
    "name" TEXT NOT NULL,
    "objectiveKey" TEXT NOT NULL,
    "structure" JSONB NOT NULL,
    "description" TEXT,
    "exampleOutput" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContentTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContentTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ContentTemplate_brandId_organizationId_fkey" FOREIGN KEY ("brandId", "organizationId") REFERENCES "Brand" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ContentTemplate_objectiveKey_fkey" FOREIGN KEY ("objectiveKey") REFERENCES "ContentObjective" ("key") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ContentTemplate" ("createdAt", "description", "exampleOutput", "id", "name", "objectiveKey", "structure", "updatedAt", "userId") SELECT "createdAt", "description", "exampleOutput", "id", "name", "objectiveKey", "structure", "updatedAt", "userId" FROM "ContentTemplate";
DROP TABLE "ContentTemplate";
ALTER TABLE "new_ContentTemplate" RENAME TO "ContentTemplate";
CREATE INDEX "ContentTemplate_objectiveKey_idx" ON "ContentTemplate"("objectiveKey");
CREATE INDEX "ContentTemplate_organizationId_brandId_idx" ON "ContentTemplate"("organizationId", "brandId");
CREATE TABLE "new_ExportHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "brandId" TEXT,
    "kind" TEXT NOT NULL,
    "scope" TEXT,
    "filename" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExportHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExportHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExportHistory_brandId_organizationId_fkey" FOREIGN KEY ("brandId", "organizationId") REFERENCES "Brand" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ExportHistory" ("createdAt", "filename", "id", "kind", "scope", "userId") SELECT "createdAt", "filename", "id", "kind", "scope", "userId" FROM "ExportHistory";
DROP TABLE "ExportHistory";
ALTER TABLE "new_ExportHistory" RENAME TO "ExportHistory";
CREATE INDEX "ExportHistory_userId_idx" ON "ExportHistory"("userId");
CREATE INDEX "ExportHistory_organizationId_brandId_idx" ON "ExportHistory"("organizationId", "brandId");
CREATE TABLE "new_FacebookAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerRef" TEXT NOT NULL DEFAULT 'local',
    "organizationId" TEXT,
    "brandId" TEXT,
    "pageId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "tokenExpiresAt" DATETIME,
    "linkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FacebookAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FacebookAccount_brandId_organizationId_fkey" FOREIGN KEY ("brandId", "organizationId") REFERENCES "Brand" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_FacebookAccount" ("accessToken", "id", "linkedAt", "ownerRef", "pageId", "pageName", "tokenExpiresAt") SELECT "accessToken", "id", "linkedAt", "ownerRef", "pageId", "pageName", "tokenExpiresAt" FROM "FacebookAccount";
DROP TABLE "FacebookAccount";
ALTER TABLE "new_FacebookAccount" RENAME TO "FacebookAccount";
CREATE INDEX "FacebookAccount_organizationId_brandId_idx" ON "FacebookAccount"("organizationId", "brandId");
CREATE UNIQUE INDEX "FacebookAccount_ownerRef_pageId_key" ON "FacebookAccount"("ownerRef", "pageId");
CREATE UNIQUE INDEX "FacebookAccount_brandId_pageId_key" ON "FacebookAccount"("brandId", "pageId");
CREATE TABLE "new_Framework" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "organizationId" TEXT,
    "brandId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "steps" JSONB,
    "whenToUse" TEXT,
    "example" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Framework_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Framework_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Framework_brandId_organizationId_fkey" FOREIGN KEY ("brandId", "organizationId") REFERENCES "Brand" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Framework" ("createdAt", "example", "id", "name", "slug", "steps", "summary", "updatedAt", "userId", "whenToUse") SELECT "createdAt", "example", "id", "name", "slug", "steps", "summary", "updatedAt", "userId", "whenToUse" FROM "Framework";
DROP TABLE "Framework";
ALTER TABLE "new_Framework" RENAME TO "Framework";
CREATE UNIQUE INDEX "Framework_slug_key" ON "Framework"("slug");
CREATE INDEX "Framework_organizationId_brandId_idx" ON "Framework"("organizationId", "brandId");
CREATE TABLE "new_Goal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "brandId" TEXT,
    "name" TEXT NOT NULL,
    "goalType" TEXT NOT NULL,
    "timeRangeStart" DATETIME,
    "timeRangeEnd" DATETIME,
    "targetAudience" TEXT,
    "mainOffer" TEXT,
    "mainMessage" TEXT,
    "kpi" JSONB,
    "contentRatio" JSONB,
    "risk" TEXT,
    "successDefinition" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Goal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Goal_brandId_organizationId_fkey" FOREIGN KEY ("brandId", "organizationId") REFERENCES "Brand" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Goal" ("contentRatio", "createdAt", "goalType", "id", "kpi", "mainMessage", "mainOffer", "name", "risk", "status", "successDefinition", "targetAudience", "timeRangeEnd", "timeRangeStart", "updatedAt", "userId") SELECT "contentRatio", "createdAt", "goalType", "id", "kpi", "mainMessage", "mainOffer", "name", "risk", "status", "successDefinition", "targetAudience", "timeRangeEnd", "timeRangeStart", "updatedAt", "userId" FROM "Goal";
DROP TABLE "Goal";
ALTER TABLE "new_Goal" RENAME TO "Goal";
CREATE INDEX "Goal_userId_status_idx" ON "Goal"("userId", "status");
CREATE INDEX "Goal_organizationId_brandId_idx" ON "Goal"("organizationId", "brandId");
CREATE TABLE "new_PerformanceInsight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "brandId" TEXT,
    "scope" TEXT NOT NULL,
    "refId" TEXT,
    "period" TEXT,
    "finding" TEXT NOT NULL,
    "evidence" JSONB,
    "recommendation" TEXT,
    "confidence" TEXT NOT NULL DEFAULT 'normal',
    "aiPromptRunId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PerformanceInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PerformanceInsight_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PerformanceInsight_brandId_organizationId_fkey" FOREIGN KEY ("brandId", "organizationId") REFERENCES "Brand" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PerformanceInsight_aiPromptRunId_fkey" FOREIGN KEY ("aiPromptRunId") REFERENCES "PromptRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PerformanceInsight" ("aiPromptRunId", "confidence", "createdAt", "evidence", "finding", "id", "period", "recommendation", "refId", "scope", "userId") SELECT "aiPromptRunId", "confidence", "createdAt", "evidence", "finding", "id", "period", "recommendation", "refId", "scope", "userId" FROM "PerformanceInsight";
DROP TABLE "PerformanceInsight";
ALTER TABLE "new_PerformanceInsight" RENAME TO "PerformanceInsight";
CREATE INDEX "PerformanceInsight_userId_scope_idx" ON "PerformanceInsight"("userId", "scope");
CREATE INDEX "PerformanceInsight_organizationId_brandId_idx" ON "PerformanceInsight"("organizationId", "brandId");
CREATE TABLE "new_Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentDraftId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "brandId" TEXT,
    "strategyVersionId" TEXT,
    "dailyPlanId" TEXT,
    "facebookAccountId" TEXT,
    "publishedAt" DATETIME,
    "platform" TEXT NOT NULL DEFAULT 'facebook',
    "permalink" TEXT,
    "finalText" TEXT,
    "objectiveKey" TEXT,
    "pillarId" TEXT,
    "hookStyle" TEXT,
    "ctaIntensity" TEXT,
    "format" TEXT,
    "topic" TEXT,
    "status" TEXT NOT NULL DEFAULT 'posted',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Post_contentDraftId_fkey" FOREIGN KEY ("contentDraftId") REFERENCES "ContentDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Post_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Post_brandId_organizationId_fkey" FOREIGN KEY ("brandId", "organizationId") REFERENCES "Brand" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Post_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Post_dailyPlanId_fkey" FOREIGN KEY ("dailyPlanId") REFERENCES "DailyPlan" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Post_facebookAccountId_fkey" FOREIGN KEY ("facebookAccountId") REFERENCES "FacebookAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Post" ("contentDraftId", "createdAt", "ctaIntensity", "dailyPlanId", "facebookAccountId", "finalText", "format", "hookStyle", "id", "objectiveKey", "permalink", "pillarId", "platform", "publishedAt", "status", "strategyVersionId", "topic", "updatedAt", "userId") SELECT "contentDraftId", "createdAt", "ctaIntensity", "dailyPlanId", "facebookAccountId", "finalText", "format", "hookStyle", "id", "objectiveKey", "permalink", "pillarId", "platform", "publishedAt", "status", "strategyVersionId", "topic", "updatedAt", "userId" FROM "Post";
DROP TABLE "Post";
ALTER TABLE "new_Post" RENAME TO "Post";
CREATE UNIQUE INDEX "Post_contentDraftId_key" ON "Post"("contentDraftId");
CREATE INDEX "Post_userId_idx" ON "Post"("userId");
CREATE INDEX "Post_strategyVersionId_idx" ON "Post"("strategyVersionId");
CREATE INDEX "Post_facebookAccountId_idx" ON "Post"("facebookAccountId");
CREATE INDEX "Post_organizationId_brandId_idx" ON "Post"("organizationId", "brandId");
CREATE TABLE "new_PromptRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "promptTemplateId" TEXT,
    "organizationId" TEXT,
    "brandId" TEXT,
    "moduleKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input" JSONB,
    "rawOutput" TEXT,
    "parsedOutput" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "latencyMs" INTEGER,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromptRun_promptTemplateId_fkey" FOREIGN KEY ("promptTemplateId") REFERENCES "PromptTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PromptRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PromptRun_brandId_organizationId_fkey" FOREIGN KEY ("brandId", "organizationId") REFERENCES "Brand" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PromptRun_tenant_pair_check" CHECK (
        ("organizationId" IS NULL AND "brandId" IS NULL) OR
        ("organizationId" IS NOT NULL AND "brandId" IS NOT NULL)
    )
);
INSERT INTO "new_PromptRun" ("createdAt", "error", "id", "input", "latencyMs", "model", "moduleKey", "parsedOutput", "promptTemplateId", "provider", "rawOutput", "status", "tokensIn", "tokensOut") SELECT "createdAt", "error", "id", "input", "latencyMs", "model", "moduleKey", "parsedOutput", "promptTemplateId", "provider", "rawOutput", "status", "tokensIn", "tokensOut" FROM "PromptRun";
DROP TABLE "PromptRun";
ALTER TABLE "new_PromptRun" RENAME TO "PromptRun";
CREATE INDEX "PromptRun_moduleKey_status_createdAt_idx" ON "PromptRun"("moduleKey", "status", "createdAt");
CREATE INDEX "PromptRun_organizationId_brandId_createdAt_idx" ON "PromptRun"("organizationId", "brandId", "createdAt");
CREATE TABLE "new_Strategy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "brandId" TEXT,
    "goalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timeframeDays" INTEGER NOT NULL DEFAULT 30,
    "frameworkSlug" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Strategy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Strategy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Strategy_brandId_organizationId_fkey" FOREIGN KEY ("brandId", "organizationId") REFERENCES "Brand" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Strategy_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Strategy_frameworkSlug_fkey" FOREIGN KEY ("frameworkSlug") REFERENCES "Framework" ("slug") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Strategy" ("createdAt", "frameworkSlug", "goalId", "id", "name", "status", "timeframeDays", "updatedAt", "userId") SELECT "createdAt", "frameworkSlug", "goalId", "id", "name", "status", "timeframeDays", "updatedAt", "userId" FROM "Strategy";
DROP TABLE "Strategy";
ALTER TABLE "new_Strategy" RENAME TO "Strategy";
CREATE INDEX "Strategy_userId_goalId_idx" ON "Strategy"("userId", "goalId");
CREATE INDEX "Strategy_organizationId_brandId_idx" ON "Strategy"("organizationId", "brandId");
CREATE TABLE "new_UserProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userIdentityId" TEXT,
    "name" TEXT NOT NULL,
    "headline" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'vi',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserProfile_userIdentityId_fkey" FOREIGN KEY ("userIdentityId") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UserProfile" ("avatarUrl", "bio", "createdAt", "headline", "id", "locale", "name", "updatedAt") SELECT "avatarUrl", "bio", "createdAt", "headline", "id", "locale", "name", "updatedAt" FROM "UserProfile";
DROP TABLE "UserProfile";
ALTER TABLE "new_UserProfile" RENAME TO "UserProfile";
CREATE UNIQUE INDEX "UserProfile_userIdentityId_key" ON "UserProfile"("userIdentityId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AuthIdentity_userIdentityId_idx" ON "AuthIdentity"("userIdentityId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthIdentity_provider_subject_key" ON "AuthIdentity"("provider", "subject");

-- CreateIndex
CREATE INDEX "Membership_organizationId_status_idx" ON "Membership"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userIdentityId_organizationId_key" ON "Membership"("userIdentityId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_id_organizationId_key" ON "Membership"("id", "organizationId");

-- CreateIndex
CREATE INDEX "Workspace_organizationId_status_idx" ON "Workspace"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_id_organizationId_key" ON "Workspace"("id", "organizationId");

-- CreateIndex
CREATE INDEX "WorkspaceRoleBinding_organizationId_workspaceId_status_idx" ON "WorkspaceRoleBinding"("organizationId", "workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceRoleBinding_membershipId_workspaceId_key" ON "WorkspaceRoleBinding"("membershipId", "workspaceId");

-- CreateIndex
CREATE INDEX "Brand_organizationId_workspaceId_status_idx" ON "Brand"("organizationId", "workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_id_organizationId_key" ON "Brand"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_id_workspaceId_organizationId_key" ON "Brand"("id", "workspaceId", "organizationId");

-- CreateIndex
CREATE INDEX "BrandRoleBinding_organizationId_workspaceId_brandId_status_idx" ON "BrandRoleBinding"("organizationId", "workspaceId", "brandId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BrandRoleBinding_membershipId_brandId_key" ON "BrandRoleBinding"("membershipId", "brandId");

-- CreateIndex
CREATE INDEX "MetricObservation_organizationId_brandId_metricKey_observedAt_idx" ON "MetricObservation"("organizationId", "brandId", "metricKey", "observedAt");

-- CreateIndex
CREATE INDEX "MetricObservation_legacyPostId_idx" ON "MetricObservation"("legacyPostId");

-- CreateIndex
CREATE UNIQUE INDEX "MetricObservation_brandId_dedupeKey_key" ON "MetricObservation"("brandId", "dedupeKey");
