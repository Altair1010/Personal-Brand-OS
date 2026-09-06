-- CreateTable
CREATE TABLE "WorkerCredential" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workerId" TEXT NOT NULL,
    "secretVerifier" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "createdByUserIdentityId" TEXT,
    "revokedByUserIdentityId" TEXT,
    "supersededByCredentialId" TEXT,
    "rotationStartedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkerCredential_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkerCredential_createdByUserIdentityId_fkey" FOREIGN KEY ("createdByUserIdentityId") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkerCredential_revokedByUserIdentityId_fkey" FOREIGN KEY ("revokedByUserIdentityId") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkerCredential_supersededByCredentialId_fkey" FOREIGN KEY ("supersededByCredentialId") REFERENCES "WorkerCredential" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkerCredential_supersededByCredentialId_key" ON "WorkerCredential"("supersededByCredentialId");

-- CreateIndex
CREATE INDEX "WorkerCredential_workerId_expiresAt_idx" ON "WorkerCredential"("workerId", "expiresAt");

-- CreateIndex
CREATE INDEX "WorkerCredential_workerId_revokedAt_idx" ON "WorkerCredential"("workerId", "revokedAt");
