-- AlterTable
ALTER TABLE "AppState" ADD COLUMN "lastCloudSyncAt" DATETIME;
ALTER TABLE "AppState" ADD COLUMN "supabaseUserId" TEXT;
