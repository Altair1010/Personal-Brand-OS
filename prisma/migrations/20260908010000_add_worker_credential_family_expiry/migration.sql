-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WorkerCredential" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workerId" TEXT NOT NULL,
    "secretVerifier" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "familyExpiresAt" DATETIME NOT NULL,
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

WITH RECURSIVE "CredentialFamily"("rootId", "credentialId") AS (
    SELECT "id", "id" FROM "WorkerCredential"
    UNION
    SELECT "CredentialFamily"."rootId", "current"."supersededByCredentialId"
    FROM "CredentialFamily"
    JOIN "WorkerCredential" AS "current" ON "current"."id" = "CredentialFamily"."credentialId"
    WHERE "current"."supersededByCredentialId" IS NOT NULL
    UNION
    SELECT "CredentialFamily"."rootId", "predecessor"."id"
    FROM "CredentialFamily"
    JOIN "WorkerCredential" AS "predecessor" ON "predecessor"."supersededByCredentialId" = "CredentialFamily"."credentialId"
),
"FamilyBounds"("rootId", "familyExpiresAt") AS (
    SELECT "CredentialFamily"."rootId", MIN("member"."expiresAt")
    FROM "CredentialFamily"
    JOIN "WorkerCredential" AS "member" ON "member"."id" = "CredentialFamily"."credentialId"
    GROUP BY "CredentialFamily"."rootId"
)
INSERT INTO "new_WorkerCredential" (
    "id", "workerId", "secretVerifier", "issuedAt", "expiresAt", "familyExpiresAt",
    "revokedAt", "createdByUserIdentityId", "revokedByUserIdentityId",
    "supersededByCredentialId", "rotationStartedAt", "createdAt"
)
SELECT
    "credential"."id", "credential"."workerId", "credential"."secretVerifier",
    "credential"."issuedAt", "credential"."expiresAt", "FamilyBounds"."familyExpiresAt",
    "credential"."revokedAt", "credential"."createdByUserIdentityId",
    "credential"."revokedByUserIdentityId", "credential"."supersededByCredentialId",
    "credential"."rotationStartedAt", "credential"."createdAt"
FROM "WorkerCredential" AS "credential"
JOIN "FamilyBounds" ON "FamilyBounds"."rootId" = "credential"."id";

DROP TABLE "WorkerCredential";
ALTER TABLE "new_WorkerCredential" RENAME TO "WorkerCredential";
CREATE UNIQUE INDEX "WorkerCredential_supersededByCredentialId_key" ON "WorkerCredential"("supersededByCredentialId");
CREATE INDEX "WorkerCredential_workerId_expiresAt_idx" ON "WorkerCredential"("workerId", "expiresAt");
CREATE INDEX "WorkerCredential_workerId_revokedAt_idx" ON "WorkerCredential"("workerId", "revokedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
