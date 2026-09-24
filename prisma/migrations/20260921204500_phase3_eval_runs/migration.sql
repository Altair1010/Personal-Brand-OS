CREATE TABLE "EvaluationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "brandId" TEXT,
    "subjectType" TEXT NOT NULL,
    "subjectRef" TEXT NOT NULL,
    "suiteRef" TEXT,
    "baselineRef" TEXT,
    "candidateRef" TEXT,
    "status" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "baselineScore" REAL,
    "delta" REAL,
    "result" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "EvaluationRun_organizationId_brandId_subjectType_createdAt_idx"
ON "EvaluationRun"("organizationId", "brandId", "subjectType", "createdAt");

CREATE INDEX "EvaluationRun_subjectRef_createdAt_idx"
ON "EvaluationRun"("subjectRef", "createdAt");
