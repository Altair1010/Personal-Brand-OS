ALTER TABLE "StrategyVersion" ADD COLUMN "sourceAgentRunId" TEXT;

CREATE UNIQUE INDEX "StrategyVersion_sourceAgentRunId_key"
ON "StrategyVersion"("sourceAgentRunId");
