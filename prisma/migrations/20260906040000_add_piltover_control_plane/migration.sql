-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "brandId" TEXT,
    "schemaVersion" TEXT NOT NULL DEFAULT '1.0',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "roleRef" TEXT NOT NULL,
    "task" JSONB NOT NULL,
    "contextRef" JSONB NOT NULL,
    "permissionManifestRef" TEXT NOT NULL,
    "requiredCapabilities" JSONB NOT NULL,
    "idempotencyKey" TEXT,
    "requestFingerprint" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "terminalResult" JSONB,
    "terminalFingerprint" TEXT,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentRun_workspaceId_organizationId_fkey" FOREIGN KEY ("workspaceId", "organizationId") REFERENCES "Workspace" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentRun_brandId_workspaceId_organizationId_fkey" FOREIGN KEY ("brandId", "workspaceId", "organizationId") REFERENCES "Brand" ("id", "workspaceId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentRun_status_check" CHECK ("status" IN ('QUEUED', 'WAITING_FOR_WORKER', 'CLAIMED', 'RUNNING', 'WAITING_APPROVAL', 'RETRY_PENDING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    CONSTRAINT "AgentRun_scope_check" CHECK ("brandId" IS NULL OR "workspaceId" IS NOT NULL)
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "priority" INTEGER NOT NULL DEFAULT 50,
    "requiredCapabilities" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextAttemptAt" DATETIME,
    "currentLeaseId" TEXT,
    "terminalFingerprint" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Job_runId_organizationId_fkey" FOREIGN KEY ("runId", "organizationId") REFERENCES "AgentRun" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Job_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Job_workspaceId_organizationId_fkey" FOREIGN KEY ("workspaceId", "organizationId") REFERENCES "Workspace" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Job_brandId_workspaceId_organizationId_fkey" FOREIGN KEY ("brandId", "workspaceId", "organizationId") REFERENCES "Brand" ("id", "workspaceId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Job_currentLeaseId_fkey" FOREIGN KEY ("currentLeaseId") REFERENCES "WorkerLease" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Job_status_check" CHECK ("status" IN ('QUEUED', 'CLAIMED', 'RUNNING', 'RETRY_PENDING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    CONSTRAINT "Job_priority_check" CHECK ("priority" BETWEEN 0 AND 100),
    CONSTRAINT "Job_attempt_check" CHECK ("attemptCount" >= 0 AND "maxAttempts" > 0 AND "attemptCount" <= "maxAttempts")
);

-- CreateTable
CREATE TABLE "RunEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "schemaVersion" TEXT NOT NULL DEFAULT '1.0',
    "eventType" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "correlationId" TEXT NOT NULL,
    "payload" JSONB,
    "workerId" TEXT,
    "leaseId" TEXT,
    "contentHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RunEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RunEvent_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RunEvent_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "WorkerLease" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RunEvent_sequence_check" CHECK ("sequence" >= 0)
);

-- CreateTable
CREATE TABLE "Worker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceName" TEXT NOT NULL,
    "os" TEXT,
    "runtimeAdapter" TEXT NOT NULL,
    "runtimeVersion" TEXT NOT NULL,
    "protocolVersion" TEXT,
    "repoMappings" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "capabilityVersion" INTEGER NOT NULL DEFAULT 1,
    "registeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Worker_status_check" CHECK ("status" IN ('ACTIVE', 'DISABLED', 'REVOKED')),
    CONSTRAINT "Worker_capabilityVersion_check" CHECK ("capabilityVersion" > 0)
);

-- CreateTable
CREATE TABLE "WorkerCapability" (
    "workerId" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("workerId", "capability"),
    CONSTRAINT "WorkerCapability_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkerLease" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "issuedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    "endReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkerLease_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkerLease_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkerLease_attempt_check" CHECK ("generation" > 0 AND "attemptNumber" > 0),
    CONSTRAINT "WorkerLease_time_check" CHECK ("expiresAt" > "issuedAt" AND ("endedAt" IS NULL OR "endedAt" >= "issuedAt"))
);

-- CreateTable
CREATE TABLE "WorkerWorkspaceGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workerId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "grantedAt" DATETIME NOT NULL,
    "grantedByUserIdentityId" TEXT NOT NULL,
    "revokedAt" DATETIME,
    "revokedByUserIdentityId" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkerWorkspaceGrant_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkerWorkspaceGrant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkerWorkspaceGrant_workspaceId_organizationId_fkey" FOREIGN KEY ("workspaceId", "organizationId") REFERENCES "Workspace" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkerWorkspaceGrant_grantedByUserIdentityId_fkey" FOREIGN KEY ("grantedByUserIdentityId") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkerWorkspaceGrant_revokedByUserIdentityId_fkey" FOREIGN KEY ("revokedByUserIdentityId") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkerWorkspaceGrant_lifecycle_check" CHECK (
        ("status" = 'ACTIVE' AND "revokedAt" IS NULL AND "revokedByUserIdentityId" IS NULL) OR
        ("status" = 'REVOKED' AND "revokedAt" IS NOT NULL AND "revokedByUserIdentityId" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "WorkerBrandGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workerId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "grantedAt" DATETIME NOT NULL,
    "grantedByUserIdentityId" TEXT NOT NULL,
    "revokedAt" DATETIME,
    "revokedByUserIdentityId" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkerBrandGrant_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkerBrandGrant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkerBrandGrant_workspaceId_organizationId_fkey" FOREIGN KEY ("workspaceId", "organizationId") REFERENCES "Workspace" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkerBrandGrant_brandId_workspaceId_organizationId_fkey" FOREIGN KEY ("brandId", "workspaceId", "organizationId") REFERENCES "Brand" ("id", "workspaceId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkerBrandGrant_grantedByUserIdentityId_fkey" FOREIGN KEY ("grantedByUserIdentityId") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkerBrandGrant_revokedByUserIdentityId_fkey" FOREIGN KEY ("revokedByUserIdentityId") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkerBrandGrant_lifecycle_check" CHECK (
        ("status" = 'ACTIVE' AND "revokedAt" IS NULL AND "revokedByUserIdentityId" IS NULL) OR
        ("status" = 'REVOKED' AND "revokedAt" IS NOT NULL AND "revokedByUserIdentityId" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "runId" TEXT,
    "schemaVersion" TEXT NOT NULL DEFAULT '1.0',
    "actionType" TEXT NOT NULL,
    "targetRef" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "workspaceId" TEXT,
    "brandId" TEXT,
    "requiredCapability" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedByUserIdentityId" TEXT NOT NULL,
    "decidedByUserIdentityId" TEXT,
    "decidedAt" DATETIME,
    "expiresAt" DATETIME NOT NULL,
    "oneTimeNonce" TEXT,
    "consumedAt" DATETIME,
    "consumedByUserIdentityId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApprovalRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ApprovalRequest_workspaceId_organizationId_fkey" FOREIGN KEY ("workspaceId", "organizationId") REFERENCES "Workspace" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ApprovalRequest_brandId_workspaceId_organizationId_fkey" FOREIGN KEY ("brandId", "workspaceId", "organizationId") REFERENCES "Brand" ("id", "workspaceId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ApprovalRequest_runId_organizationId_fkey" FOREIGN KEY ("runId", "organizationId") REFERENCES "AgentRun" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ApprovalRequest_requestedByUserIdentityId_fkey" FOREIGN KEY ("requestedByUserIdentityId") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ApprovalRequest_decidedByUserIdentityId_fkey" FOREIGN KEY ("decidedByUserIdentityId") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ApprovalRequest_consumedByUserIdentityId_fkey" FOREIGN KEY ("consumedByUserIdentityId") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ApprovalRequest_status_check" CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED')),
    CONSTRAINT "ApprovalRequest_target_check" CHECK (
        ("targetType" = 'ORGANIZATION' AND "workspaceId" IS NULL AND "brandId" IS NULL) OR
        ("targetType" = 'WORKSPACE' AND "workspaceId" IS NOT NULL AND "brandId" IS NULL) OR
        ("targetType" = 'BRAND' AND "workspaceId" IS NOT NULL AND "brandId" IS NOT NULL)
    ),
    CONSTRAINT "ApprovalRequest_consumption_check" CHECK (
        ("consumedAt" IS NULL AND "consumedByUserIdentityId" IS NULL) OR
        ("status" = 'APPROVED' AND "oneTimeNonce" IS NOT NULL AND "consumedAt" IS NOT NULL AND "consumedByUserIdentityId" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "AuditEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "metadata" JSONB,
    "occurredAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AgentRun_organizationId_workspaceId_brandId_status_idx" ON "AgentRun"("organizationId", "workspaceId", "brandId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AgentRun_id_organizationId_key" ON "AgentRun"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentRun_organizationId_idempotencyKey_key" ON "AgentRun"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Job_runId_key" ON "Job"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "Job_currentLeaseId_key" ON "Job"("currentLeaseId");

-- CreateIndex
CREATE INDEX "Job_status_nextAttemptAt_priority_createdAt_id_idx" ON "Job"("status", "nextAttemptAt", "priority", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Job_organizationId_workspaceId_brandId_idx" ON "Job"("organizationId", "workspaceId", "brandId");

-- CreateIndex
CREATE UNIQUE INDEX "Job_id_organizationId_key" ON "Job"("id", "organizationId");

-- CreateIndex
CREATE INDEX "RunEvent_runId_sequence_idx" ON "RunEvent"("runId", "sequence");

-- CreateIndex
CREATE INDEX "RunEvent_workerId_idx" ON "RunEvent"("workerId");

-- CreateIndex
CREATE UNIQUE INDEX "RunEvent_runId_sequence_key" ON "RunEvent"("runId", "sequence");

-- CreateIndex
CREATE INDEX "Worker_status_lastSeenAt_idx" ON "Worker"("status", "lastSeenAt");

-- CreateIndex
CREATE INDEX "WorkerCapability_capability_idx" ON "WorkerCapability"("capability");

-- CreateIndex
CREATE INDEX "WorkerLease_jobId_expiresAt_idx" ON "WorkerLease"("jobId", "expiresAt");

-- CreateIndex
CREATE INDEX "WorkerLease_workerId_expiresAt_idx" ON "WorkerLease"("workerId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerLease_jobId_generation_key" ON "WorkerLease"("jobId", "generation");

-- CreateIndex
CREATE INDEX "WorkerWorkspaceGrant_workerId_status_workspaceId_idx" ON "WorkerWorkspaceGrant"("workerId", "status", "workspaceId");

-- CreateIndex
CREATE INDEX "WorkerWorkspaceGrant_organizationId_workspaceId_status_idx" ON "WorkerWorkspaceGrant"("organizationId", "workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerWorkspaceGrant_workerId_workspaceId_key" ON "WorkerWorkspaceGrant"("workerId", "workspaceId");

-- CreateIndex
CREATE INDEX "WorkerBrandGrant_workerId_status_brandId_idx" ON "WorkerBrandGrant"("workerId", "status", "brandId");

-- CreateIndex
CREATE INDEX "WorkerBrandGrant_organizationId_workspaceId_brandId_status_idx" ON "WorkerBrandGrant"("organizationId", "workspaceId", "brandId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerBrandGrant_workerId_brandId_key" ON "WorkerBrandGrant"("workerId", "brandId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRequest_oneTimeNonce_key" ON "ApprovalRequest"("oneTimeNonce");

-- CreateIndex
CREATE INDEX "ApprovalRequest_organizationId_status_expiresAt_idx" ON "ApprovalRequest"("organizationId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "ApprovalRequest_runId_idx" ON "ApprovalRequest"("runId");

-- CreateIndex
CREATE INDEX "AuditEntry_organizationId_targetType_targetId_occurredAt_idx" ON "AuditEntry"("organizationId", "targetType", "targetId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEntry_organizationId_action_occurredAt_idx" ON "AuditEntry"("organizationId", "action", "occurredAt");
