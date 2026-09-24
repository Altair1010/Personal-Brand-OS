-- H2.2 Durable Scheduling & Real External Execution
ALTER TABLE "PublishingJob" ADD COLUMN "payloadFingerprint" TEXT;
ALTER TABLE "PublishingJob" ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "PublishingJob" ADD COLUMN "nextAttemptAt" DATETIME;
ALTER TABLE "PublishingJob" ADD COLUMN "leaseOwner" TEXT;
ALTER TABLE "PublishingJob" ADD COLUMN "leaseExpiresAt" DATETIME;
ALTER TABLE "PublishingJob" ADD COLUMN "providerResponse" JSONB;
ALTER TABLE "PublishingJob" ADD COLUMN "errorCategory" TEXT;
ALTER TABLE "PublishingJob" ADD COLUMN "blockedReason" TEXT;
ALTER TABLE "PublishingJob" ADD COLUMN "startedAt" DATETIME;
ALTER TABLE "PublishingJob" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "PublishingAttempt" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publishingJobId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "workerId" TEXT NOT NULL,
  "payloadFingerprint" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'STARTED',
  "errorCategory" TEXT,
  "errorMessage" TEXT,
  "retryAfterMs" INTEGER,
  "providerPostId" TEXT,
  "providerResponse" JSONB,
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" DATETIME,
  CONSTRAINT "PublishingAttempt_publishingJobId_fkey" FOREIGN KEY ("publishingJobId") REFERENCES "PublishingJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PublishingAttempt_publishingJobId_attemptNumber_key" ON "PublishingAttempt"("publishingJobId", "attemptNumber");
CREATE INDEX "PublishingAttempt_publishingJobId_status_idx" ON "PublishingAttempt"("publishingJobId", "status");
CREATE INDEX "PublishingAttempt_requestFingerprint_idx" ON "PublishingAttempt"("requestFingerprint");
CREATE INDEX "PublishingJob_status_nextAttemptAt_scheduledAt_idx" ON "PublishingJob"("status", "nextAttemptAt", "scheduledAt");
CREATE INDEX "PublishingJob_leaseExpiresAt_idx" ON "PublishingJob"("leaseExpiresAt");

UPDATE "PublishingJob"
SET "payloadFingerprint" = NULL,
    "nextAttemptAt" = COALESCE("scheduledAt", "createdAt")
WHERE "nextAttemptAt" IS NULL;
