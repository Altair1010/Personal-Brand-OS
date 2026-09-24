-- H4.1 secure .ENV vault
CREATE TABLE "EnvVaultEntry" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT,
  "secretCiphertext" TEXT,
  "isSecret" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "EnvVaultEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EnvVaultEntry_workspaceId_organizationId_fkey" FOREIGN KEY ("workspaceId","organizationId") REFERENCES "Workspace" ("id","organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EnvVaultEntry_brandId_workspaceId_organizationId_fkey" FOREIGN KEY ("brandId","workspaceId","organizationId") REFERENCES "Brand" ("id","workspaceId","organizationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "EnvVaultEntry_brandId_key_key" ON "EnvVaultEntry"("brandId","key");
CREATE INDEX "EnvVaultEntry_organizationId_workspaceId_brandId_idx" ON "EnvVaultEntry"("organizationId","workspaceId","brandId");

CREATE TABLE "EnvVaultSecurity" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "pinSalt" TEXT NOT NULL,
  "pinHash" TEXT NOT NULL,
  "failedAttempts" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "EnvVaultSecurity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EnvVaultSecurity_workspaceId_organizationId_fkey" FOREIGN KEY ("workspaceId","organizationId") REFERENCES "Workspace" ("id","organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EnvVaultSecurity_brandId_workspaceId_organizationId_fkey" FOREIGN KEY ("brandId","workspaceId","organizationId") REFERENCES "Brand" ("id","workspaceId","organizationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "EnvVaultSecurity_brandId_key" ON "EnvVaultSecurity"("brandId");
CREATE UNIQUE INDEX "EnvVaultSecurity_brandId_workspaceId_organizationId_key" ON "EnvVaultSecurity"("brandId","workspaceId","organizationId");
CREATE INDEX "EnvVaultSecurity_organizationId_workspaceId_brandId_idx" ON "EnvVaultSecurity"("organizationId","workspaceId","brandId");
