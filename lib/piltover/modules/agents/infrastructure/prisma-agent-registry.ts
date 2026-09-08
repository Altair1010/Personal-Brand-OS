import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { stableHash, stableJson } from "../../../shared/contracts/stable-json";
import type { ClockPort } from "../../../shared/ports/core-ports";
import { PrismaTenantAccess, type ExternalActor, type TenantTarget } from "../../identity/infrastructure/prisma-tenant-access";
import {
  AgentDefinitionSpecV1Schema,
  AgentRoleSpecV1Schema,
  ArtifactOwnerScopeSchema,
  ArtifactTargetScopeSchema,
  isArtifactApplicableToScope,
  type AgentDefinitionSpecV1,
  type AgentParentStatus,
  type AgentRoleSpecV1,
  type AgentVersionStatus,
  type ArtifactOwnerScope,
  type ArtifactTargetScope,
  type TenantArtifactOwnerScope,
} from "../domain/registry";

type Database = PrismaClient | Prisma.TransactionClient;
type ParentRow = {
  readonly id: string;
  readonly name: string;
  readonly ownerScope: string;
  readonly organizationId: string | null;
  readonly workspaceId: string | null;
  readonly brandId: string | null;
  readonly status: string;
  readonly revision: number;
};

const systemClock: ClockPort = { now: () => new Date() };

export interface AgentParentRecord {
  readonly id: string;
  readonly name: string;
  readonly owner: ArtifactOwnerScope;
  readonly status: AgentParentStatus;
  readonly revision: number;
}

export interface AgentDefinitionVersionRecord {
  readonly id: string;
  readonly definitionId: string;
  readonly versionOrdinal: number;
  readonly status: AgentVersionStatus;
  readonly specSchemaVersion: "1.0";
  readonly payload: AgentDefinitionSpecV1;
  readonly contentHash: string | null;
}

export interface AgentRoleVersionRecord {
  readonly id: string;
  readonly roleId: string;
  readonly versionOrdinal: number;
  readonly status: AgentVersionStatus;
  readonly specSchemaVersion: "1.0";
  readonly payload: AgentRoleSpecV1;
  readonly contentHash: string | null;
}

function requireText(value: string, code: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function ownerFromRow(row: ParentRow): ArtifactOwnerScope {
  const candidate = row.ownerScope === "PLATFORM"
    ? { type: "PLATFORM" as const }
    : row.ownerScope === "ORGANIZATION"
      ? { type: "ORGANIZATION" as const, organizationId: row.organizationId }
      : row.ownerScope === "WORKSPACE"
        ? { type: "WORKSPACE" as const, organizationId: row.organizationId, workspaceId: row.workspaceId }
        : row.ownerScope === "BRAND"
          ? {
              type: "BRAND" as const,
              organizationId: row.organizationId,
              workspaceId: row.workspaceId,
              brandId: row.brandId,
            }
          : null;
  const parsed = ArtifactOwnerScopeSchema.safeParse(candidate);
  if (!parsed.success) throw new Error("INVALID_OWNER_SCOPE");
  return parsed.data;
}

function parentRecord(row: ParentRow): AgentParentRecord {
  return {
    id: row.id,
    name: row.name,
    owner: ownerFromRow(row),
    status: row.status as AgentParentStatus,
    revision: row.revision,
  };
}

function ownerColumns(owner: ArtifactOwnerScope) {
  return {
    ownerScope: owner.type,
    organizationId: owner.type === "PLATFORM" ? null : owner.organizationId,
    workspaceId: owner.type === "WORKSPACE" || owner.type === "BRAND" ? owner.workspaceId : null,
    brandId: owner.type === "BRAND" ? owner.brandId : null,
  };
}

function tenantTarget(owner: TenantArtifactOwnerScope): TenantTarget {
  if (owner.type === "ORGANIZATION") return { type: "ORGANIZATION", id: owner.organizationId };
  if (owner.type === "WORKSPACE") return { type: "WORKSPACE", id: owner.workspaceId };
  return { type: "BRAND", id: owner.brandId };
}

async function assertOwnerAncestry(db: Database, owner: ArtifactOwnerScope): Promise<void> {
  if (owner.type === "PLATFORM") return;
  const organization = await db.organization.findUnique({ where: { id: owner.organizationId } });
  if (!organization) throw new Error("TENANT_ANCESTRY_MISMATCH");
  if (owner.type === "ORGANIZATION") return;
  const workspace = await db.workspace.findUnique({ where: { id: owner.workspaceId } });
  if (!workspace || workspace.organizationId !== owner.organizationId) throw new Error("TENANT_ANCESTRY_MISMATCH");
  if (owner.type === "WORKSPACE") return;
  const brand = await db.brand.findUnique({ where: { id: owner.brandId } });
  if (!brand || brand.organizationId !== owner.organizationId || brand.workspaceId !== owner.workspaceId) {
    throw new Error("TENANT_ANCESTRY_MISMATCH");
  }
}

async function assertTargetAncestry(db: Database, targetInput: ArtifactTargetScope): Promise<ArtifactTargetScope> {
  const target = ArtifactTargetScopeSchema.parse(targetInput);
  const organization = await db.organization.findUnique({ where: { id: target.organizationId } });
  if (!organization) throw new Error("TENANT_ANCESTRY_MISMATCH");
  if (target.type === "ORGANIZATION") return target;
  const workspace = await db.workspace.findUnique({ where: { id: target.workspaceId } });
  if (!workspace || workspace.organizationId !== target.organizationId) throw new Error("TENANT_ANCESTRY_MISMATCH");
  if (target.type === "WORKSPACE") return target;
  const brand = await db.brand.findUnique({ where: { id: target.brandId } });
  if (!brand || brand.organizationId !== target.organizationId || brand.workspaceId !== target.workspaceId) {
    throw new Error("TENANT_ANCESTRY_MISMATCH");
  }
  return target;
}

async function authorizeOwnerMutation(db: Database, actor: ExternalActor, owner: ArtifactOwnerScope): Promise<string> {
  await assertOwnerAncestry(db, owner);
  if (owner.type === "PLATFORM") throw new Error("UNAUTHORIZED");
  const capability = owner.type === "ORGANIZATION" ? "organization.manage" : "agent.manage";
  const decision = await new PrismaTenantAccess(db).authorize(actor, tenantTarget(owner), capability);
  if (!decision.allowed) throw new Error("UNAUTHORIZED");
  const identity = await db.authIdentity.findUnique({
    where: { provider_subject: actor },
    include: { userIdentity: true },
  });
  if (!identity || identity.userIdentity.status !== "ACTIVE") throw new Error("UNAUTHORIZED");
  return identity.userIdentityId;
}

function definitionVersionRecord(row: {
  id: string;
  definitionId: string;
  versionOrdinal: number;
  status: string;
  specSchemaVersion: string;
  semanticPayload: Prisma.JsonValue;
  contentHash: string | null;
}): AgentDefinitionVersionRecord {
  if (row.specSchemaVersion !== "1.0") throw new Error("AGENT_SPEC_SCHEMA_UNSUPPORTED");
  return {
    id: row.id,
    definitionId: row.definitionId,
    versionOrdinal: row.versionOrdinal,
    status: row.status as AgentVersionStatus,
    specSchemaVersion: "1.0",
    payload: AgentDefinitionSpecV1Schema.parse(row.semanticPayload),
    contentHash: row.contentHash,
  };
}

function roleVersionRecord(row: {
  id: string;
  roleId: string;
  versionOrdinal: number;
  status: string;
  specSchemaVersion: string;
  semanticPayload: Prisma.JsonValue;
  contentHash: string | null;
}): AgentRoleVersionRecord {
  if (row.specSchemaVersion !== "1.0") throw new Error("AGENT_SPEC_SCHEMA_UNSUPPORTED");
  return {
    id: row.id,
    roleId: row.roleId,
    versionOrdinal: row.versionOrdinal,
    status: row.status as AgentVersionStatus,
    specSchemaVersion: "1.0",
    payload: AgentRoleSpecV1Schema.parse(row.semanticPayload),
    contentHash: row.contentHash,
  };
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(stableJson(value)) as Prisma.InputJsonValue;
}

function publicationHash(specSchemaVersion: string, payload: unknown): string {
  return stableHash({ specSchemaVersion, semanticPayload: payload });
}

function isPublicationConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /PUBLISHED_VERSION_CONFLICT|Unique constraint|database is locked|Transaction API error|timed out/i.test(message);
}

export class PrismaAgentRegistry {
  constructor(
    private readonly db: PrismaClient,
    private readonly clock: ClockPort = systemClock,
  ) {}

  async createDefinition(
    actor: ExternalActor,
    input: { readonly name: string; readonly owner: ArtifactOwnerScope },
    correlationId: string,
  ): Promise<AgentParentRecord> {
    const owner = ArtifactOwnerScopeSchema.parse(input.owner);
    const name = requireText(input.name, "AGENT_DEFINITION_NAME_INVALID");
    return this.db.$transaction(async (tx) => {
      const actorId = await authorizeOwnerMutation(tx, actor, owner);
      const now = this.clock.now();
      const row = await tx.agentDefinition.create({ data: {
        id: randomUUID(), name, ...ownerColumns(owner), createdAt: now, updatedAt: now,
      } });
      await this.audit(tx, owner.type === "PLATFORM" ? null : owner.organizationId, actorId,
        "AGENT_DEFINITION_CREATED", "AGENT_DEFINITION", row.id, correlationId, now);
      return parentRecord(row);
    });
  }

  async createRole(
    actor: ExternalActor,
    input: { readonly name: string; readonly owner: ArtifactOwnerScope },
    correlationId: string,
  ): Promise<AgentParentRecord> {
    const owner = ArtifactOwnerScopeSchema.parse(input.owner);
    const name = requireText(input.name, "AGENT_ROLE_NAME_INVALID");
    return this.db.$transaction(async (tx) => {
      const actorId = await authorizeOwnerMutation(tx, actor, owner);
      const now = this.clock.now();
      const row = await tx.agentRole.create({ data: {
        id: randomUUID(), name, ...ownerColumns(owner), createdAt: now, updatedAt: now,
      } });
      await this.audit(tx, owner.type === "PLATFORM" ? null : owner.organizationId, actorId,
        "AGENT_ROLE_CREATED", "AGENT_ROLE", row.id, correlationId, now);
      return parentRecord(row);
    });
  }

  async createDefinitionDraft(
    actor: ExternalActor,
    input: {
      readonly definitionId: string;
      readonly versionOrdinal: number;
      readonly specSchemaVersion: "1.0";
      readonly payload: AgentDefinitionSpecV1;
    },
    correlationId: string,
  ): Promise<AgentDefinitionVersionRecord> {
    if (!Number.isInteger(input.versionOrdinal) || input.versionOrdinal <= 0) throw new Error("AGENT_VERSION_ORDINAL_INVALID");
    if (input.specSchemaVersion !== "1.0") throw new Error("AGENT_SPEC_SCHEMA_UNSUPPORTED");
    const payload = AgentDefinitionSpecV1Schema.parse(input.payload);
    return this.db.$transaction(async (tx) => {
      const parent = await tx.agentDefinition.findUnique({ where: { id: input.definitionId } });
      if (!parent) throw new Error("AGENT_DEFINITION_NOT_FOUND");
      const owner = ownerFromRow(parent);
      const actorId = await authorizeOwnerMutation(tx, actor, owner);
      if (parent.status === "ARCHIVED") throw new Error("PARENT_ARCHIVED");
      const now = this.clock.now();
      const row = await tx.agentDefinitionVersion.create({ data: {
        id: randomUUID(), definitionId: parent.id, versionOrdinal: input.versionOrdinal,
        baseRevision: parent.revision, specSchemaVersion: "1.0", semanticPayload: jsonValue(payload),
        createdAt: now, updatedAt: now,
      } });
      await this.audit(tx, parent.organizationId, actorId, "AGENT_DEFINITION_DRAFT_CREATED",
        "AGENT_DEFINITION_VERSION", row.id, correlationId, now);
      return definitionVersionRecord(row);
    });
  }

  async createRoleDraft(
    actor: ExternalActor,
    input: {
      readonly roleId: string;
      readonly versionOrdinal: number;
      readonly specSchemaVersion: "1.0";
      readonly payload: AgentRoleSpecV1;
    },
    correlationId: string,
  ): Promise<AgentRoleVersionRecord> {
    if (!Number.isInteger(input.versionOrdinal) || input.versionOrdinal <= 0) throw new Error("AGENT_VERSION_ORDINAL_INVALID");
    if (input.specSchemaVersion !== "1.0") throw new Error("AGENT_SPEC_SCHEMA_UNSUPPORTED");
    const payload = AgentRoleSpecV1Schema.parse(input.payload);
    return this.db.$transaction(async (tx) => {
      const parent = await tx.agentRole.findUnique({ where: { id: input.roleId } });
      if (!parent) throw new Error("AGENT_ROLE_NOT_FOUND");
      const owner = ownerFromRow(parent);
      const actorId = await authorizeOwnerMutation(tx, actor, owner);
      if (parent.status === "ARCHIVED") throw new Error("PARENT_ARCHIVED");
      const now = this.clock.now();
      const row = await tx.agentRoleVersion.create({ data: {
        id: randomUUID(), roleId: parent.id, versionOrdinal: input.versionOrdinal,
        baseRevision: parent.revision, specSchemaVersion: "1.0", semanticPayload: jsonValue(payload),
        createdAt: now, updatedAt: now,
      } });
      await this.audit(tx, parent.organizationId, actorId, "AGENT_ROLE_DRAFT_CREATED",
        "AGENT_ROLE_VERSION", row.id, correlationId, now);
      return roleVersionRecord(row);
    });
  }

  async updateDefinitionDraft(
    actor: ExternalActor,
    versionId: string,
    input: AgentDefinitionSpecV1,
    correlationId: string,
  ): Promise<AgentDefinitionVersionRecord> {
    const payload = AgentDefinitionSpecV1Schema.parse(input);
    return this.db.$transaction(async (tx) => {
      const version = await tx.agentDefinitionVersion.findUnique({
        where: { id: versionId }, include: { definition: true },
      });
      if (!version) throw new Error("AGENT_DEFINITION_VERSION_NOT_FOUND");
      const owner = ownerFromRow(version.definition);
      const actorId = await authorizeOwnerMutation(tx, actor, owner);
      if (version.definition.status === "ARCHIVED") throw new Error("PARENT_ARCHIVED");
      if (version.status !== "DRAFT") throw new Error("VERSION_IMMUTABLE");
      const now = this.clock.now();
      const updated = await tx.agentDefinitionVersion.update({
        where: { id: version.id }, data: { semanticPayload: jsonValue(payload), updatedAt: now },
      });
      await this.audit(tx, version.definition.organizationId, actorId, "AGENT_DEFINITION_DRAFT_UPDATED",
        "AGENT_DEFINITION_VERSION", version.id, correlationId, now);
      return definitionVersionRecord(updated);
    });
  }

  async updateRoleDraft(
    actor: ExternalActor,
    versionId: string,
    input: AgentRoleSpecV1,
    correlationId: string,
  ): Promise<AgentRoleVersionRecord> {
    const payload = AgentRoleSpecV1Schema.parse(input);
    return this.db.$transaction(async (tx) => {
      const version = await tx.agentRoleVersion.findUnique({ where: { id: versionId }, include: { role: true } });
      if (!version) throw new Error("AGENT_ROLE_VERSION_NOT_FOUND");
      const owner = ownerFromRow(version.role);
      const actorId = await authorizeOwnerMutation(tx, actor, owner);
      if (version.role.status === "ARCHIVED") throw new Error("PARENT_ARCHIVED");
      if (version.status !== "DRAFT") throw new Error("VERSION_IMMUTABLE");
      const now = this.clock.now();
      const updated = await tx.agentRoleVersion.update({
        where: { id: version.id }, data: { semanticPayload: jsonValue(payload), updatedAt: now },
      });
      await this.audit(tx, version.role.organizationId, actorId, "AGENT_ROLE_DRAFT_UPDATED",
        "AGENT_ROLE_VERSION", version.id, correlationId, now);
      return roleVersionRecord(updated);
    });
  }

  async publishDefinitionVersion(actor: ExternalActor, versionId: string, correlationId: string): Promise<AgentDefinitionVersionRecord> {
    try {
      return await this.db.$transaction(async (tx) => {
        const version = await tx.agentDefinitionVersion.findUnique({
          where: { id: versionId }, include: { definition: true },
        });
        if (!version) throw new Error("AGENT_DEFINITION_VERSION_NOT_FOUND");
        const owner = ownerFromRow(version.definition);
        const actorId = await authorizeOwnerMutation(tx, actor, owner);
        if (version.status !== "DRAFT") throw new Error("VERSION_IMMUTABLE");
        if (version.definition.status !== "ACTIVE") throw new Error("PARENT_NOT_ACTIVE");
        const claimed = await tx.agentDefinition.updateMany({
          where: { id: version.definitionId, revision: version.baseRevision, status: "ACTIVE" },
          data: { revision: { increment: 1 } },
        });
        if (claimed.count !== 1) throw new Error("PUBLISHED_VERSION_CONFLICT");
        const now = this.clock.now();
        await tx.agentDefinitionVersion.updateMany({
          where: { definitionId: version.definitionId, status: "PUBLISHED" },
          data: { status: "RETIRED", retiredAt: now },
        });
        const payload = AgentDefinitionSpecV1Schema.parse(version.semanticPayload);
        const updated = await tx.agentDefinitionVersion.update({
          where: { id: version.id },
          data: { status: "PUBLISHED", contentHash: publicationHash(version.specSchemaVersion, payload), publishedAt: now },
        });
        await this.audit(tx, version.definition.organizationId, actorId, "AGENT_DEFINITION_VERSION_PUBLISHED",
          "AGENT_DEFINITION_VERSION", version.id, correlationId, now);
        return definitionVersionRecord(updated);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (isPublicationConflict(error)) throw new Error("PUBLISHED_VERSION_CONFLICT");
      throw error;
    }
  }

  async publishRoleVersion(actor: ExternalActor, versionId: string, correlationId: string): Promise<AgentRoleVersionRecord> {
    try {
      return await this.db.$transaction(async (tx) => {
        const version = await tx.agentRoleVersion.findUnique({ where: { id: versionId }, include: { role: true } });
        if (!version) throw new Error("AGENT_ROLE_VERSION_NOT_FOUND");
        const owner = ownerFromRow(version.role);
        const actorId = await authorizeOwnerMutation(tx, actor, owner);
        if (version.status !== "DRAFT") throw new Error("VERSION_IMMUTABLE");
        if (version.role.status !== "ACTIVE") throw new Error("PARENT_NOT_ACTIVE");
        const claimed = await tx.agentRole.updateMany({
          where: { id: version.roleId, revision: version.baseRevision, status: "ACTIVE" },
          data: { revision: { increment: 1 } },
        });
        if (claimed.count !== 1) throw new Error("PUBLISHED_VERSION_CONFLICT");
        const now = this.clock.now();
        await tx.agentRoleVersion.updateMany({
          where: { roleId: version.roleId, status: "PUBLISHED" },
          data: { status: "RETIRED", retiredAt: now },
        });
        const payload = AgentRoleSpecV1Schema.parse(version.semanticPayload);
        const updated = await tx.agentRoleVersion.update({
          where: { id: version.id },
          data: { status: "PUBLISHED", contentHash: publicationHash(version.specSchemaVersion, payload), publishedAt: now },
        });
        await this.audit(tx, version.role.organizationId, actorId, "AGENT_ROLE_VERSION_PUBLISHED",
          "AGENT_ROLE_VERSION", version.id, correlationId, now);
        return roleVersionRecord(updated);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (isPublicationConflict(error)) throw new Error("PUBLISHED_VERSION_CONFLICT");
      throw error;
    }
  }

  async retireDefinitionVersion(actor: ExternalActor, versionId: string, correlationId: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const version = await tx.agentDefinitionVersion.findUnique({ where: { id: versionId }, include: { definition: true } });
      if (!version) throw new Error("AGENT_DEFINITION_VERSION_NOT_FOUND");
      const actorId = await authorizeOwnerMutation(tx, actor, ownerFromRow(version.definition));
      if (version.status !== "PUBLISHED") throw new Error("VERSION_NOT_SELECTABLE");
      const now = this.clock.now();
      await tx.agentDefinitionVersion.update({ where: { id: version.id }, data: { status: "RETIRED", retiredAt: now } });
      await tx.agentDefinition.update({ where: { id: version.definitionId }, data: { revision: { increment: 1 } } });
      await this.audit(tx, version.definition.organizationId, actorId, "AGENT_DEFINITION_VERSION_RETIRED",
        "AGENT_DEFINITION_VERSION", version.id, correlationId, now);
    });
  }

  async retireRoleVersion(actor: ExternalActor, versionId: string, correlationId: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const version = await tx.agentRoleVersion.findUnique({ where: { id: versionId }, include: { role: true } });
      if (!version) throw new Error("AGENT_ROLE_VERSION_NOT_FOUND");
      const actorId = await authorizeOwnerMutation(tx, actor, ownerFromRow(version.role));
      if (version.status !== "PUBLISHED") throw new Error("VERSION_NOT_SELECTABLE");
      const now = this.clock.now();
      await tx.agentRoleVersion.update({ where: { id: version.id }, data: { status: "RETIRED", retiredAt: now } });
      await tx.agentRole.update({ where: { id: version.roleId }, data: { revision: { increment: 1 } } });
      await this.audit(tx, version.role.organizationId, actorId, "AGENT_ROLE_VERSION_RETIRED",
        "AGENT_ROLE_VERSION", version.id, correlationId, now);
    });
  }

  async suspendDefinition(actor: ExternalActor, id: string, correlationId: string): Promise<void> {
    await this.changeDefinitionStatus(actor, id, "SUSPENDED", correlationId);
  }

  async resumeDefinition(actor: ExternalActor, id: string, correlationId: string): Promise<void> {
    await this.changeDefinitionStatus(actor, id, "ACTIVE", correlationId);
  }

  async archiveDefinition(actor: ExternalActor, id: string, correlationId: string): Promise<void> {
    await this.changeDefinitionStatus(actor, id, "ARCHIVED", correlationId);
  }

  async suspendRole(actor: ExternalActor, id: string, correlationId: string): Promise<void> {
    await this.changeRoleStatus(actor, id, "SUSPENDED", correlationId);
  }

  async resumeRole(actor: ExternalActor, id: string, correlationId: string): Promise<void> {
    await this.changeRoleStatus(actor, id, "ACTIVE", correlationId);
  }

  async archiveRole(actor: ExternalActor, id: string, correlationId: string): Promise<void> {
    await this.changeRoleStatus(actor, id, "ARCHIVED", correlationId);
  }

  async resolveDefinitionVersionForNewSelection(versionId: string, targetInput: ArtifactTargetScope): Promise<AgentDefinitionVersionRecord> {
    const version = await this.db.agentDefinitionVersion.findUnique({ where: { id: versionId }, include: { definition: true } });
    if (!version) throw new Error("AGENT_DEFINITION_VERSION_NOT_FOUND");
    if (version.definition.status !== "ACTIVE") throw new Error("PARENT_NOT_ACTIVE");
    if (version.status !== "PUBLISHED") throw new Error("VERSION_NOT_SELECTABLE");
    const target = await assertTargetAncestry(this.db, targetInput);
    if (!isArtifactApplicableToScope(ownerFromRow(version.definition), target)) throw new Error("TENANT_ANCESTRY_MISMATCH");
    return definitionVersionRecord(version);
  }

  async resolveRoleVersionForNewSelection(versionId: string, targetInput: ArtifactTargetScope): Promise<AgentRoleVersionRecord> {
    const version = await this.db.agentRoleVersion.findUnique({ where: { id: versionId }, include: { role: true } });
    if (!version) throw new Error("AGENT_ROLE_VERSION_NOT_FOUND");
    if (version.role.status !== "ACTIVE") throw new Error("PARENT_NOT_ACTIVE");
    if (version.status !== "PUBLISHED") throw new Error("VERSION_NOT_SELECTABLE");
    const target = await assertTargetAncestry(this.db, targetInput);
    if (!isArtifactApplicableToScope(ownerFromRow(version.role), target)) throw new Error("TENANT_ANCESTRY_MISMATCH");
    return roleVersionRecord(version);
  }

  async resolveDefinitionVersionHistorically(versionId: string): Promise<AgentDefinitionVersionRecord> {
    const version = await this.db.agentDefinitionVersion.findUnique({ where: { id: versionId } });
    if (!version) throw new Error("AGENT_DEFINITION_VERSION_NOT_FOUND");
    return definitionVersionRecord(version);
  }

  async resolveRoleVersionHistorically(versionId: string): Promise<AgentRoleVersionRecord> {
    const version = await this.db.agentRoleVersion.findUnique({ where: { id: versionId } });
    if (!version) throw new Error("AGENT_ROLE_VERSION_NOT_FOUND");
    return roleVersionRecord(version);
  }

  async resolveCurrentPublishedDefinition(definitionId: string, target: ArtifactTargetScope): Promise<AgentDefinitionVersionRecord> {
    const version = await this.db.agentDefinitionVersion.findFirst({
      where: { definitionId, status: "PUBLISHED" }, select: { id: true },
    });
    if (!version) throw new Error("VERSION_NOT_SELECTABLE");
    return this.resolveDefinitionVersionForNewSelection(version.id, target);
  }

  async resolveCurrentPublishedRole(roleId: string, target: ArtifactTargetScope): Promise<AgentRoleVersionRecord> {
    const version = await this.db.agentRoleVersion.findFirst({
      where: { roleId, status: "PUBLISHED" }, select: { id: true },
    });
    if (!version) throw new Error("VERSION_NOT_SELECTABLE");
    return this.resolveRoleVersionForNewSelection(version.id, target);
  }

  private async changeDefinitionStatus(
    actor: ExternalActor,
    id: string,
    next: AgentParentStatus,
    correlationId: string,
  ): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const parent = await tx.agentDefinition.findUnique({ where: { id } });
      if (!parent) throw new Error("AGENT_DEFINITION_NOT_FOUND");
      const actorId = await authorizeOwnerMutation(tx, actor, ownerFromRow(parent));
      this.assertParentTransition(parent.status as AgentParentStatus, next);
      if (parent.status === next) return;
      const now = this.clock.now();
      await tx.agentDefinition.update({ where: { id }, data: { status: next, revision: { increment: 1 } } });
      await this.audit(tx, parent.organizationId, actorId, `AGENT_DEFINITION_${next}`,
        "AGENT_DEFINITION", id, correlationId, now);
    });
  }

  private async changeRoleStatus(
    actor: ExternalActor,
    id: string,
    next: AgentParentStatus,
    correlationId: string,
  ): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const parent = await tx.agentRole.findUnique({ where: { id } });
      if (!parent) throw new Error("AGENT_ROLE_NOT_FOUND");
      const actorId = await authorizeOwnerMutation(tx, actor, ownerFromRow(parent));
      this.assertParentTransition(parent.status as AgentParentStatus, next);
      if (parent.status === next) return;
      const now = this.clock.now();
      await tx.agentRole.update({ where: { id }, data: { status: next, revision: { increment: 1 } } });
      await this.audit(tx, parent.organizationId, actorId, `AGENT_ROLE_${next}`,
        "AGENT_ROLE", id, correlationId, now);
    });
  }

  private assertParentTransition(current: AgentParentStatus, next: AgentParentStatus): void {
    if (current === "ARCHIVED" && next !== "ARCHIVED") throw new Error("PARENT_ARCHIVED");
    if (next === current) return;
    const allowed =
      (current === "ACTIVE" && (next === "SUSPENDED" || next === "ARCHIVED")) ||
      (current === "SUSPENDED" && (next === "ACTIVE" || next === "ARCHIVED"));
    if (!allowed) throw new Error("AGENT_PARENT_TRANSITION_INVALID");
  }

  private async audit(
    tx: Prisma.TransactionClient,
    organizationId: string | null,
    actorId: string,
    action: string,
    targetType: string,
    targetId: string,
    correlationIdInput: string,
    occurredAt: Date,
  ): Promise<void> {
    const correlationId = requireText(correlationIdInput, "AGENT_CORRELATION_ID_INVALID");
    await tx.auditEntry.create({ data: {
      id: randomUUID(), organizationId, actorType: "HUMAN", actorId,
      action, targetType, targetId, correlationId, occurredAt,
    } });
  }
}
