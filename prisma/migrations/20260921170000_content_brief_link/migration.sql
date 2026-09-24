ALTER TABLE "ContentDraft" ADD COLUMN "contentBriefId" TEXT;
CREATE INDEX "ContentDraft_contentBriefId_idx" ON "ContentDraft"("contentBriefId");
