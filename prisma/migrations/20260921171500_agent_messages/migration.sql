CREATE TABLE "AgentMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threadId" TEXT NOT NULL,
    "runId" TEXT,
    "role" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentMessage_threadId_fkey"
      FOREIGN KEY ("threadId") REFERENCES "AgentThread" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AgentMessage_threadId_createdAt_idx"
ON "AgentMessage"("threadId", "createdAt");

CREATE INDEX "AgentMessage_runId_idx"
ON "AgentMessage"("runId");
