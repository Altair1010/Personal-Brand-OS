-- AlterTable
ALTER TABLE "MetricSnapshot" ADD COLUMN "fbRawResponse" JSONB;
ALTER TABLE "MetricSnapshot" ADD COLUMN "fetchedAt" DATETIME;
ALTER TABLE "MetricSnapshot" ADD COLUMN "postUrl" TEXT;

-- CreateTable
CREATE TABLE "FacebookAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerRef" TEXT NOT NULL DEFAULT 'local',
    "pageId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "tokenExpiresAt" DATETIME,
    "linkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentDraftId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
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
    CONSTRAINT "Post_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Post_dailyPlanId_fkey" FOREIGN KEY ("dailyPlanId") REFERENCES "DailyPlan" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Post_facebookAccountId_fkey" FOREIGN KEY ("facebookAccountId") REFERENCES "FacebookAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Post" ("contentDraftId", "createdAt", "ctaIntensity", "dailyPlanId", "finalText", "format", "hookStyle", "id", "objectiveKey", "permalink", "pillarId", "platform", "publishedAt", "status", "strategyVersionId", "topic", "updatedAt", "userId") SELECT "contentDraftId", "createdAt", "ctaIntensity", "dailyPlanId", "finalText", "format", "hookStyle", "id", "objectiveKey", "permalink", "pillarId", "platform", "publishedAt", "status", "strategyVersionId", "topic", "updatedAt", "userId" FROM "Post";
DROP TABLE "Post";
ALTER TABLE "new_Post" RENAME TO "Post";
CREATE UNIQUE INDEX "Post_contentDraftId_key" ON "Post"("contentDraftId");
CREATE INDEX "Post_userId_idx" ON "Post"("userId");
CREATE INDEX "Post_strategyVersionId_idx" ON "Post"("strategyVersionId");
CREATE INDEX "Post_facebookAccountId_idx" ON "Post"("facebookAccountId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "FacebookAccount_ownerRef_pageId_key" ON "FacebookAccount"("ownerRef", "pageId");
