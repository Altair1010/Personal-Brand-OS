-- CreateTable
CREATE TABLE "AppState" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "activeGoalId" TEXT,
    "activeStrategyId" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "headline" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'vi',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BrandDNA" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
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
    CONSTRAINT "BrandDNA_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
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
    CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AudienceSegment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
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
    CONSTRAINT "AudienceSegment_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContentPillar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "goalId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ratioPercent" INTEGER NOT NULL DEFAULT 0,
    "objectiveMix" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContentPillar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContentPillar_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContentObjective" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT
);

-- CreateTable
CREATE TABLE "ContentTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "objectiveKey" TEXT NOT NULL,
    "structure" JSONB NOT NULL,
    "description" TEXT,
    "exampleOutput" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContentTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContentTemplate_objectiveKey_fkey" FOREIGN KEY ("objectiveKey") REFERENCES "ContentObjective" ("key") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Framework" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "steps" JSONB,
    "whenToUse" TEXT,
    "example" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Framework_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Strategy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timeframeDays" INTEGER NOT NULL DEFAULT 30,
    "frameworkSlug" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Strategy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Strategy_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Strategy_frameworkSlug_fkey" FOREIGN KEY ("frameworkSlug") REFERENCES "Framework" ("slug") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StrategyVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "strategyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "assumptions" JSONB,
    "contentRatio" JSONB,
    "weeklyThemes" JSONB,
    "dailyPlanOutline" JSONB,
    "ctaPlan" JSONB,
    "topicMap" JSONB,
    "recommendedTemplates" JSONB,
    "kpiToTrack" JSONB,
    "doNotList" JSONB,
    "aiPromptRunId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StrategyVersion_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StrategyVersion_aiPromptRunId_fkey" FOREIGN KEY ("aiPromptRunId") REFERENCES "PromptRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WeeklyPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "strategyVersionId" TEXT NOT NULL,
    "weekIndex" INTEGER NOT NULL,
    "theme" TEXT,
    "focusPillarId" TEXT,
    "objectivesMix" JSONB,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WeeklyPlan_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weeklyPlanId" TEXT NOT NULL,
    "date" DATETIME,
    "dayIndex" INTEGER NOT NULL,
    "plannedObjective" TEXT,
    "plannedPillarId" TEXT,
    "suggestedTopic" TEXT,
    "suggestedCta" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyPlan_weeklyPlanId_fkey" FOREIGN KEY ("weeklyPlanId") REFERENCES "WeeklyPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DailyPlan_plannedPillarId_fkey" FOREIGN KEY ("plannedPillarId") REFERENCES "ContentPillar" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContentIdea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dailyPlanId" TEXT,
    "userId" TEXT NOT NULL,
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
    CONSTRAINT "ContentIdea_pillarId_fkey" FOREIGN KEY ("pillarId") REFERENCES "ContentPillar" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContentDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentIdeaId" TEXT,
    "userId" TEXT NOT NULL,
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
    CONSTRAINT "ContentDraft_pillarId_fkey" FOREIGN KEY ("pillarId") REFERENCES "ContentPillar" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ContentDraft_aiPromptRunId_fkey" FOREIGN KEY ("aiPromptRunId") REFERENCES "PromptRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentDraftId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "strategyVersionId" TEXT,
    "dailyPlanId" TEXT,
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
    CONSTRAINT "Post_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Post_dailyPlanId_fkey" FOREIGN KEY ("dailyPlanId") REFERENCES "DailyPlan" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MetricSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "daysSincePost" INTEGER,
    "reach" INTEGER,
    "engagement" INTEGER,
    "comments" INTEGER,
    "shares" INTEGER,
    "saves" INTEGER,
    "inboxNote" TEXT,
    "conversionNote" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    CONSTRAINT "MetricSnapshot_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PerformanceInsight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
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
    CONSTRAINT "PerformanceInsight_aiPromptRunId_fkey" FOREIGN KEY ("aiPromptRunId") REFERENCES "PromptRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PromptTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "moduleKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "systemInstruction" TEXT NOT NULL,
    "userTemplate" TEXT NOT NULL,
    "inputSchema" JSONB,
    "outputSchema" JSONB,
    "validationNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PromptRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "promptTemplateId" TEXT,
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
    CONSTRAINT "PromptRun_promptTemplateId_fkey" FOREIGN KEY ("promptTemplateId") REFERENCES "PromptTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AIModelConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "label" TEXT,
    "temperature" REAL,
    "maxTokens" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ExportHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "scope" TEXT,
    "filename" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExportHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandDNA_userId_key" ON "BrandDNA"("userId");

-- CreateIndex
CREATE INDEX "Goal_userId_status_idx" ON "Goal"("userId", "status");

-- CreateIndex
CREATE INDEX "AudienceSegment_userId_idx" ON "AudienceSegment"("userId");

-- CreateIndex
CREATE INDEX "ContentPillar_userId_idx" ON "ContentPillar"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentObjective_key_key" ON "ContentObjective"("key");

-- CreateIndex
CREATE INDEX "ContentTemplate_objectiveKey_idx" ON "ContentTemplate"("objectiveKey");

-- CreateIndex
CREATE UNIQUE INDEX "Framework_slug_key" ON "Framework"("slug");

-- CreateIndex
CREATE INDEX "Strategy_userId_goalId_idx" ON "Strategy"("userId", "goalId");

-- CreateIndex
CREATE INDEX "StrategyVersion_strategyId_version_idx" ON "StrategyVersion"("strategyId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "StrategyVersion_strategyId_version_key" ON "StrategyVersion"("strategyId", "version");

-- CreateIndex
CREATE INDEX "WeeklyPlan_strategyVersionId_idx" ON "WeeklyPlan"("strategyVersionId");

-- CreateIndex
CREATE INDEX "DailyPlan_weeklyPlanId_idx" ON "DailyPlan"("weeklyPlanId");

-- CreateIndex
CREATE INDEX "ContentIdea_userId_status_idx" ON "ContentIdea"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Post_contentDraftId_key" ON "Post"("contentDraftId");

-- CreateIndex
CREATE INDEX "Post_userId_idx" ON "Post"("userId");

-- CreateIndex
CREATE INDEX "Post_strategyVersionId_idx" ON "Post"("strategyVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "MetricSnapshot_postId_key" ON "MetricSnapshot"("postId");

-- CreateIndex
CREATE INDEX "PerformanceInsight_userId_scope_idx" ON "PerformanceInsight"("userId", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "PromptTemplate_moduleKey_version_key" ON "PromptTemplate"("moduleKey", "version");

-- CreateIndex
CREATE INDEX "PromptRun_moduleKey_status_createdAt_idx" ON "PromptRun"("moduleKey", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ExportHistory_userId_idx" ON "ExportHistory"("userId");
