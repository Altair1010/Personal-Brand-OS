CREATE TABLE "ContentAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentDraftId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'UPLOAD',
    "mediaType" TEXT NOT NULL DEFAULT 'FILE',
    "fileName" TEXT,
    "mimeType" TEXT,
    "localPath" TEXT,
    "sourceUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContentAsset_contentDraftId_fkey" FOREIGN KEY ("contentDraftId") REFERENCES "ContentDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ContentAsset_contentDraftId_sortOrder_idx" ON "ContentAsset"("contentDraftId", "sortOrder");
CREATE INDEX "ContentAsset_status_idx" ON "ContentAsset"("status");
