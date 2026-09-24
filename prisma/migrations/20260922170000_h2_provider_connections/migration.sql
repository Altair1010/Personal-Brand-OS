CREATE TABLE "ProviderConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "externalAccountId" TEXT,
    "externalAccountName" TEXT,
    "credentialCiphertext" TEXT,
    "refreshTokenCiphertext" TEXT,
    "tokenExpiresAt" DATETIME,
    "scopes" JSONB,
    "capabilities" JSONB,
    "health" JSONB,
    "lastVerifiedAt" DATETIME,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProviderConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProviderConnection_workspaceId_organizationId_fkey" FOREIGN KEY ("workspaceId", "organizationId") REFERENCES "Workspace" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProviderConnection_brandId_workspaceId_organizationId_fkey" FOREIGN KEY ("brandId", "workspaceId", "organizationId") REFERENCES "Brand" ("id", "workspaceId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ProviderResource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "capabilities" JSONB,
    "metadata" JSONB,
    "credentialCiphertext" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProviderResource_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ProviderConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ProviderOAuthAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProviderOAuthAttempt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProviderOAuthAttempt_workspaceId_organizationId_fkey" FOREIGN KEY ("workspaceId", "organizationId") REFERENCES "Workspace" ("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProviderOAuthAttempt_brandId_workspaceId_organizationId_fkey" FOREIGN KEY ("brandId", "workspaceId", "organizationId") REFERENCES "Brand" ("id", "workspaceId", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ProviderConnection_organizationId_workspaceId_brandId_provider_status_idx"
ON "ProviderConnection"("organizationId", "workspaceId", "brandId", "provider", "status");

CREATE UNIQUE INDEX "ProviderConnection_brandId_provider_externalAccountId_key"
ON "ProviderConnection"("brandId", "provider", "externalAccountId");

CREATE INDEX "ProviderResource_connectionId_status_idx"
ON "ProviderResource"("connectionId", "status");

CREATE UNIQUE INDEX "ProviderResource_connectionId_resourceType_externalId_key"
ON "ProviderResource"("connectionId", "resourceType", "externalId");

CREATE UNIQUE INDEX "ProviderOAuthAttempt_state_key"
ON "ProviderOAuthAttempt"("state");

CREATE INDEX "ProviderOAuthAttempt_organizationId_workspaceId_brandId_provider_status_idx"
ON "ProviderOAuthAttempt"("organizationId", "workspaceId", "brandId", "provider", "status");

CREATE INDEX "ProviderOAuthAttempt_expiresAt_idx"
ON "ProviderOAuthAttempt"("expiresAt");
