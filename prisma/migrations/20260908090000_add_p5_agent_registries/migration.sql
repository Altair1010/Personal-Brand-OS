-- CreateTable
CREATE TABLE "AgentDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "ownerScope" TEXT NOT NULL,
    "organizationId" TEXT,
    "workspaceId" TEXT,
    "brandId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentDefinition_workspaceId_organizationId_fkey" FOREIGN KEY ("workspaceId", "organizationId") REFERENCES "Workspace" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentDefinition_brandId_workspaceId_organizationId_fkey" FOREIGN KEY ("brandId", "workspaceId", "organizationId") REFERENCES "Brand" ("id", "workspaceId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentDefinition_owner_scope_check" CHECK (
      ("ownerScope" = 'PLATFORM' AND "organizationId" IS NULL AND "workspaceId" IS NULL AND "brandId" IS NULL) OR
      ("ownerScope" = 'ORGANIZATION' AND "organizationId" IS NOT NULL AND "workspaceId" IS NULL AND "brandId" IS NULL) OR
      ("ownerScope" = 'WORKSPACE' AND "organizationId" IS NOT NULL AND "workspaceId" IS NOT NULL AND "brandId" IS NULL) OR
      ("ownerScope" = 'BRAND' AND "organizationId" IS NOT NULL AND "workspaceId" IS NOT NULL AND "brandId" IS NOT NULL)
    ),
    CONSTRAINT "AgentDefinition_status_check" CHECK ("status" IN ('ACTIVE', 'SUSPENDED', 'ARCHIVED')),
    CONSTRAINT "AgentDefinition_revision_check" CHECK ("revision" >= 0)
);

-- CreateTable
CREATE TABLE "AgentDefinitionVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "definitionId" TEXT NOT NULL,
    "versionOrdinal" INTEGER NOT NULL,
    "baseRevision" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "specSchemaVersion" TEXT NOT NULL,
    "semanticPayload" JSONB NOT NULL,
    "contentHash" TEXT,
    "publishedAt" DATETIME,
    "retiredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentDefinitionVersion_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "AgentDefinition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentDefinitionVersion_ordinal_check" CHECK ("versionOrdinal" > 0),
    CONSTRAINT "AgentDefinitionVersion_base_revision_check" CHECK ("baseRevision" >= 0),
    CONSTRAINT "AgentDefinitionVersion_lifecycle_check" CHECK (
      ("status" = 'DRAFT' AND "contentHash" IS NULL AND "publishedAt" IS NULL AND "retiredAt" IS NULL) OR
      ("status" = 'PUBLISHED' AND "contentHash" IS NOT NULL AND "publishedAt" IS NOT NULL AND "retiredAt" IS NULL) OR
      ("status" = 'RETIRED' AND "contentHash" IS NOT NULL AND "publishedAt" IS NOT NULL AND "retiredAt" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "AgentRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "ownerScope" TEXT NOT NULL,
    "organizationId" TEXT,
    "workspaceId" TEXT,
    "brandId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentRole_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentRole_workspaceId_organizationId_fkey" FOREIGN KEY ("workspaceId", "organizationId") REFERENCES "Workspace" ("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentRole_brandId_workspaceId_organizationId_fkey" FOREIGN KEY ("brandId", "workspaceId", "organizationId") REFERENCES "Brand" ("id", "workspaceId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentRole_owner_scope_check" CHECK (
      ("ownerScope" = 'PLATFORM' AND "organizationId" IS NULL AND "workspaceId" IS NULL AND "brandId" IS NULL) OR
      ("ownerScope" = 'ORGANIZATION' AND "organizationId" IS NOT NULL AND "workspaceId" IS NULL AND "brandId" IS NULL) OR
      ("ownerScope" = 'WORKSPACE' AND "organizationId" IS NOT NULL AND "workspaceId" IS NOT NULL AND "brandId" IS NULL) OR
      ("ownerScope" = 'BRAND' AND "organizationId" IS NOT NULL AND "workspaceId" IS NOT NULL AND "brandId" IS NOT NULL)
    ),
    CONSTRAINT "AgentRole_status_check" CHECK ("status" IN ('ACTIVE', 'SUSPENDED', 'ARCHIVED')),
    CONSTRAINT "AgentRole_revision_check" CHECK ("revision" >= 0)
);

-- CreateTable
CREATE TABLE "AgentRoleVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roleId" TEXT NOT NULL,
    "versionOrdinal" INTEGER NOT NULL,
    "baseRevision" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "specSchemaVersion" TEXT NOT NULL,
    "semanticPayload" JSONB NOT NULL,
    "contentHash" TEXT,
    "publishedAt" DATETIME,
    "retiredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentRoleVersion_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AgentRole" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentRoleVersion_ordinal_check" CHECK ("versionOrdinal" > 0),
    CONSTRAINT "AgentRoleVersion_base_revision_check" CHECK ("baseRevision" >= 0),
    CONSTRAINT "AgentRoleVersion_lifecycle_check" CHECK (
      ("status" = 'DRAFT' AND "contentHash" IS NULL AND "publishedAt" IS NULL AND "retiredAt" IS NULL) OR
      ("status" = 'PUBLISHED' AND "contentHash" IS NOT NULL AND "publishedAt" IS NOT NULL AND "retiredAt" IS NULL) OR
      ("status" = 'RETIRED' AND "contentHash" IS NOT NULL AND "publishedAt" IS NOT NULL AND "retiredAt" IS NOT NULL)
    )
);

-- CreateIndex
CREATE INDEX "AgentDefinition_ownerScope_organizationId_workspaceId_brandId_status_idx" ON "AgentDefinition"("ownerScope", "organizationId", "workspaceId", "brandId", "status");
CREATE UNIQUE INDEX "AgentDefinitionVersion_definitionId_versionOrdinal_key" ON "AgentDefinitionVersion"("definitionId", "versionOrdinal");
CREATE INDEX "AgentDefinitionVersion_definitionId_status_versionOrdinal_idx" ON "AgentDefinitionVersion"("definitionId", "status", "versionOrdinal");
CREATE UNIQUE INDEX "AgentDefinitionVersion_one_published" ON "AgentDefinitionVersion"("definitionId") WHERE "status" = 'PUBLISHED';
CREATE INDEX "AgentRole_ownerScope_organizationId_workspaceId_brandId_status_idx" ON "AgentRole"("ownerScope", "organizationId", "workspaceId", "brandId", "status");
CREATE UNIQUE INDEX "AgentRoleVersion_roleId_versionOrdinal_key" ON "AgentRoleVersion"("roleId", "versionOrdinal");
CREATE INDEX "AgentRoleVersion_roleId_status_versionOrdinal_idx" ON "AgentRoleVersion"("roleId", "status", "versionOrdinal");
CREATE UNIQUE INDEX "AgentRoleVersion_one_published" ON "AgentRoleVersion"("roleId") WHERE "status" = 'PUBLISHED';

-- Published and retired semantic content is immutable. Retirement changes only lifecycle evidence.
CREATE TRIGGER "AgentDefinitionVersion_immutable_update"
BEFORE UPDATE ON "AgentDefinitionVersion"
WHEN OLD."status" IN ('PUBLISHED', 'RETIRED') AND (
  NEW."definitionId" IS NOT OLD."definitionId" OR
  NEW."versionOrdinal" IS NOT OLD."versionOrdinal" OR
  NEW."baseRevision" IS NOT OLD."baseRevision" OR
  NEW."specSchemaVersion" IS NOT OLD."specSchemaVersion" OR
  NEW."semanticPayload" IS NOT OLD."semanticPayload" OR
  NEW."contentHash" IS NOT OLD."contentHash" OR
  NEW."publishedAt" IS NOT OLD."publishedAt" OR
  (OLD."status" = 'PUBLISHED' AND NEW."status" NOT IN ('PUBLISHED', 'RETIRED')) OR
  (OLD."status" = 'RETIRED' AND (NEW."status" IS NOT OLD."status" OR NEW."retiredAt" IS NOT OLD."retiredAt"))
)
BEGIN
  SELECT RAISE(ABORT, 'VERSION_IMMUTABLE');
END;

CREATE TRIGGER "AgentRoleVersion_immutable_update"
BEFORE UPDATE ON "AgentRoleVersion"
WHEN OLD."status" IN ('PUBLISHED', 'RETIRED') AND (
  NEW."roleId" IS NOT OLD."roleId" OR
  NEW."versionOrdinal" IS NOT OLD."versionOrdinal" OR
  NEW."baseRevision" IS NOT OLD."baseRevision" OR
  NEW."specSchemaVersion" IS NOT OLD."specSchemaVersion" OR
  NEW."semanticPayload" IS NOT OLD."semanticPayload" OR
  NEW."contentHash" IS NOT OLD."contentHash" OR
  NEW."publishedAt" IS NOT OLD."publishedAt" OR
  (OLD."status" = 'PUBLISHED' AND NEW."status" NOT IN ('PUBLISHED', 'RETIRED')) OR
  (OLD."status" = 'RETIRED' AND (NEW."status" IS NOT OLD."status" OR NEW."retiredAt" IS NOT OLD."retiredAt"))
)
BEGIN
  SELECT RAISE(ABORT, 'VERSION_IMMUTABLE');
END;

CREATE TRIGGER "AgentDefinitionVersion_historical_delete"
BEFORE DELETE ON "AgentDefinitionVersion"
WHEN OLD."status" IN ('PUBLISHED', 'RETIRED')
BEGIN
  SELECT RAISE(ABORT, 'VERSION_IMMUTABLE');
END;

CREATE TRIGGER "AgentRoleVersion_historical_delete"
BEFORE DELETE ON "AgentRoleVersion"
WHEN OLD."status" IN ('PUBLISHED', 'RETIRED')
BEGIN
  SELECT RAISE(ABORT, 'VERSION_IMMUTABLE');
END;

CREATE TRIGGER "AgentDefinition_archived_terminal"
BEFORE UPDATE OF "status" ON "AgentDefinition"
WHEN OLD."status" = 'ARCHIVED' AND NEW."status" <> 'ARCHIVED'
BEGIN
  SELECT RAISE(ABORT, 'PARENT_ARCHIVED');
END;

CREATE TRIGGER "AgentDefinition_revision_monotonic"
BEFORE UPDATE ON "AgentDefinition"
WHEN NEW."revision" < OLD."revision" OR NEW."revision" > OLD."revision" + 1 OR
  (NEW."status" IS NOT OLD."status" AND NEW."revision" <> OLD."revision" + 1)
BEGIN
  SELECT RAISE(ABORT, 'AGENT_PARENT_TRANSITION_INVALID');
END;

CREATE TRIGGER "AgentRole_archived_terminal"
BEFORE UPDATE OF "status" ON "AgentRole"
WHEN OLD."status" = 'ARCHIVED' AND NEW."status" <> 'ARCHIVED'
BEGIN
  SELECT RAISE(ABORT, 'PARENT_ARCHIVED');
END;

CREATE TRIGGER "AgentRole_revision_monotonic"
BEFORE UPDATE ON "AgentRole"
WHEN NEW."revision" < OLD."revision" OR NEW."revision" > OLD."revision" + 1 OR
  (NEW."status" IS NOT OLD."status" AND NEW."revision" <> OLD."revision" + 1)
BEGIN
  SELECT RAISE(ABORT, 'AGENT_PARENT_TRANSITION_INVALID');
END;

CREATE TRIGGER "AgentDefinition_owner_immutable"
BEFORE UPDATE ON "AgentDefinition"
WHEN NEW."id" IS NOT OLD."id" OR
  NEW."ownerScope" IS NOT OLD."ownerScope" OR
  NEW."organizationId" IS NOT OLD."organizationId" OR
  NEW."workspaceId" IS NOT OLD."workspaceId" OR
  NEW."brandId" IS NOT OLD."brandId"
BEGIN
  SELECT RAISE(ABORT, 'INVALID_OWNER_SCOPE');
END;

CREATE TRIGGER "AgentRole_owner_immutable"
BEFORE UPDATE ON "AgentRole"
WHEN NEW."id" IS NOT OLD."id" OR
  NEW."ownerScope" IS NOT OLD."ownerScope" OR
  NEW."organizationId" IS NOT OLD."organizationId" OR
  NEW."workspaceId" IS NOT OLD."workspaceId" OR
  NEW."brandId" IS NOT OLD."brandId"
BEGIN
  SELECT RAISE(ABORT, 'INVALID_OWNER_SCOPE');
END;

CREATE TRIGGER "AgentDefinition_no_delete"
BEFORE DELETE ON "AgentDefinition"
BEGIN
  SELECT RAISE(ABORT, 'AGENT_DEFINITION_DELETE_DEFERRED');
END;

CREATE TRIGGER "AgentRole_no_delete"
BEFORE DELETE ON "AgentRole"
BEGIN
  SELECT RAISE(ABORT, 'AGENT_ROLE_DELETE_DEFERRED');
END;
