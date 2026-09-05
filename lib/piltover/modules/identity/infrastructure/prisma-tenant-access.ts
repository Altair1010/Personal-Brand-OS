import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  evaluateAuthorization,
  type Capability,
  type Role,
  type ScopeType,
} from "../domain/rbac";

type Database = PrismaClient | Prisma.TransactionClient;

export interface ExternalActor {
  readonly provider: string;
  readonly subject: string;
}

export interface TenantTarget {
  readonly type: ScopeType;
  readonly id: string;
}

interface AccessDecision {
  readonly allowed: boolean;
  readonly reason: string;
}

async function resolveActor(db: Database, actor: ExternalActor) {
  return db.authIdentity.findUnique({
    where: { provider_subject: actor },
    include: { userIdentity: true },
  });
}

async function resolveTarget(db: Database, target: TenantTarget) {
  if (target.type === "ORGANIZATION") {
    const organization = await db.organization.findUnique({ where: { id: target.id } });
    return organization && {
      organizationId: organization.id,
      workspaceId: null,
      brandId: null,
      organizationStatus: organization.status,
      workspaceStatus: undefined,
      brandStatus: undefined,
    };
  }
  if (target.type === "WORKSPACE") {
    const workspace = await db.workspace.findUnique({
      where: { id: target.id },
      include: { organization: true },
    });
    return workspace && {
      organizationId: workspace.organizationId,
      workspaceId: workspace.id,
      brandId: null,
      organizationStatus: workspace.organization.status,
      workspaceStatus: workspace.status,
      brandStatus: undefined,
    };
  }
  const brand = await db.brand.findUnique({
    where: { id: target.id },
    include: { organization: true, workspace: true },
  });
  return brand && {
    organizationId: brand.organizationId,
    workspaceId: brand.workspaceId,
    brandId: brand.id,
    organizationStatus: brand.organization.status,
    workspaceStatus: brand.workspace.status,
    brandStatus: brand.status,
  };
}

export class PrismaTenantAccess {
  constructor(private readonly db: PrismaClient) {}

  async authorize(
    actor: ExternalActor,
    target: TenantTarget | null,
    capability: Capability,
  ): Promise<AccessDecision> {
    if (!target) return { allowed: false, reason: "MISSING_TENANT" };
    const [identity, ancestry] = await Promise.all([
      resolveActor(this.db, actor),
      resolveTarget(this.db, target),
    ]);
    if (!identity) return { allowed: false, reason: "AUTH_IDENTITY_NOT_FOUND" };
    if (!ancestry) return { allowed: false, reason: "INVALID_TARGET" };

    const membership = await this.db.membership.findUnique({
      where: {
        userIdentityId_organizationId: {
          userIdentityId: identity.userIdentityId,
          organizationId: ancestry.organizationId,
        },
      },
    });
    if (!membership) return { allowed: false, reason: "MISSING_MEMBERSHIP" };

    const [workspaceBinding, brandBinding] = await Promise.all([
      ancestry.workspaceId
        ? this.db.workspaceRoleBinding.findUnique({
            where: { membershipId_workspaceId: { membershipId: membership.id, workspaceId: ancestry.workspaceId } },
          })
        : null,
      ancestry.brandId
        ? this.db.brandRoleBinding.findUnique({
            where: { membershipId_brandId: { membershipId: membership.id, brandId: ancestry.brandId } },
          })
        : null,
    ]);
    const decision = evaluateAuthorization({
      identityStatus: identity.userIdentity.status as "ACTIVE" | "DISABLED",
      membershipStatus: membership.status as "ACTIVE" | "SUSPENDED" | "REVOKED",
      organizationRole: membership.organizationRole as Role | null,
      workspaceRole: workspaceBinding?.status === "ACTIVE" ? workspaceBinding.role as Role : null,
      brandRole: brandBinding?.status === "ACTIVE" ? brandBinding.role as Role : null,
      capability,
      target: {
        type: target.type,
        organizationStatus: ancestry.organizationStatus as "ACTIVE" | "ARCHIVED",
        workspaceStatus: ancestry.workspaceStatus as "ACTIVE" | "ARCHIVED" | undefined,
        brandStatus: ancestry.brandStatus as "ACTIVE" | "ARCHIVED" | undefined,
      },
    });
    return decision;
  }

  async listPromptRuns(
    actor: ExternalActor,
    tenant: { readonly organizationId: string; readonly brandId: string },
  ) {
    const decision = await this.authorize(actor, { type: "BRAND", id: tenant.brandId }, "content.read");
    if (!decision.allowed) throw new Error(`PERMISSION_DENIED:${decision.reason}`);
    return this.db.promptRun.findMany({
      where: { organizationId: tenant.organizationId, brandId: tenant.brandId },
      orderBy: { id: "asc" },
    });
  }

  async createPromptRun(
    actor: ExternalActor,
    tenant: { readonly organizationId: string; readonly brandId: string },
    data: { readonly id: string; readonly moduleKey: string; readonly provider: string; readonly model: string },
  ) {
    const decision = await this.authorize(actor, { type: "BRAND", id: tenant.brandId }, "content.write");
    if (!decision.allowed) throw new Error(`PERMISSION_DENIED:${decision.reason}`);
    const brand = await this.db.brand.findUnique({ where: { id: tenant.brandId }, select: { organizationId: true } });
    if (!brand || brand.organizationId !== tenant.organizationId) throw new Error("TENANT_INVALID_ANCESTRY");
    return this.db.promptRun.create({ data: { ...data, organizationId: tenant.organizationId, brandId: tenant.brandId } });
  }
}

const NON_GOVERNANCE_ROLES: readonly Role[] = ["MANAGER", "EDITOR", "VIEWER", "APPROVER", "AGENT_OPERATOR"];

export class PrismaMembershipService {
  constructor(private readonly db: PrismaClient) {}

  private async requireManager(db: Database, actor: ExternalActor, organizationId: string) {
    const identity = await resolveActor(db, actor);
    if (!identity || identity.userIdentity.status !== "ACTIVE") throw new Error("PERMISSION_DENIED");
    const membership = await db.membership.findUnique({
      where: { userIdentityId_organizationId: { userIdentityId: identity.userIdentityId, organizationId } },
    });
    if (!membership || membership.status !== "ACTIVE" || !["OWNER", "ADMIN"].includes(membership.organizationRole ?? "")) {
      throw new Error("PERMISSION_DENIED");
    }
    return membership;
  }

  private async requireTarget(db: Database, membershipId: string) {
    const target = await db.membership.findUnique({ where: { id: membershipId } });
    if (!target) throw new Error("TENANT_MEMBERSHIP_NOT_FOUND");
    return target;
  }

  private async assertNotLastOwner(db: Database, target: { id: string; organizationId: string; organizationRole: string | null; status: string }) {
    if (target.organizationRole !== "OWNER" || target.status !== "ACTIVE") return;
    const owners = await db.membership.count({
      where: { organizationId: target.organizationId, organizationRole: "OWNER", status: "ACTIVE" },
    });
    if (owners <= 1) throw new Error("PERMISSION_LAST_OWNER_REQUIRED");
  }

  async suspend(actor: ExternalActor, membershipId: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const target = await this.requireTarget(tx, membershipId);
      await this.requireManager(tx, actor, target.organizationId);
      await this.assertNotLastOwner(tx, target);
      if (target.status !== "ACTIVE") throw new Error("TENANT_INVALID_MEMBERSHIP_TRANSITION");
      await tx.membership.update({ where: { id: membershipId }, data: { status: "SUSPENDED" } });
    });
  }

  async resume(actor: ExternalActor, membershipId: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const target = await this.requireTarget(tx, membershipId);
      await this.requireManager(tx, actor, target.organizationId);
      if (target.status === "REVOKED") throw new Error("TENANT_READMISSION_REQUIRED");
      if (target.status !== "SUSPENDED") throw new Error("TENANT_INVALID_MEMBERSHIP_TRANSITION");
      await tx.membership.update({ where: { id: membershipId }, data: { status: "ACTIVE" } });
    });
  }

  async revoke(actor: ExternalActor, membershipId: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const target = await this.requireTarget(tx, membershipId);
      await this.requireManager(tx, actor, target.organizationId);
      await this.assertNotLastOwner(tx, target);
      if (!['ACTIVE', 'SUSPENDED'].includes(target.status)) throw new Error("TENANT_INVALID_MEMBERSHIP_TRANSITION");
      await tx.workspaceRoleBinding.updateMany({ where: { membershipId, status: "ACTIVE" }, data: { status: "REVOKED" } });
      await tx.brandRoleBinding.updateMany({ where: { membershipId, status: "ACTIVE" }, data: { status: "REVOKED" } });
      await tx.membership.update({ where: { id: membershipId }, data: { status: "REVOKED", organizationRole: null } });
    });
  }

  async readmit(actor: ExternalActor, membershipId: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const target = await this.requireTarget(tx, membershipId);
      await this.requireManager(tx, actor, target.organizationId);
      if (target.status !== "REVOKED") throw new Error("TENANT_INVALID_MEMBERSHIP_TRANSITION");
      await tx.workspaceRoleBinding.updateMany({ where: { membershipId }, data: { status: "REVOKED" } });
      await tx.brandRoleBinding.updateMany({ where: { membershipId }, data: { status: "REVOKED" } });
      await tx.membership.update({ where: { id: membershipId }, data: { status: "ACTIVE", organizationRole: null } });
    });
  }

  async assignOrganizationRole(actor: ExternalActor, membershipId: string, role: Role): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const target = await this.requireTarget(tx, membershipId);
      const manager = await this.requireManager(tx, actor, target.organizationId);
      if (manager.id === target.id && target.organizationRole !== role) throw new Error("PERMISSION_SELF_ELEVATION_DENIED");
      if (target.status !== "ACTIVE") throw new Error("TENANT_INACTIVE_MEMBERSHIP");
      const allowed = manager.organizationRole === "OWNER" || NON_GOVERNANCE_ROLES.includes(role);
      if (!allowed) throw new Error("PERMISSION_ROLE_ASSIGNMENT_DENIED");
      if (target.organizationRole === "OWNER" && role !== "OWNER") await this.assertNotLastOwner(tx, target);
      await tx.membership.update({ where: { id: membershipId }, data: { organizationRole: role } });
    });
  }

  async removeOrganizationRole(actor: ExternalActor, membershipId: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const target = await this.requireTarget(tx, membershipId);
      await this.requireManager(tx, actor, target.organizationId);
      await this.assertNotLastOwner(tx, target);
      await tx.membership.update({ where: { id: membershipId }, data: { organizationRole: null } });
    });
  }

  async transferOwnership(actor: ExternalActor, fromMembershipId: string, toMembershipId: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const from = await this.requireTarget(tx, fromMembershipId);
      const to = await this.requireTarget(tx, toMembershipId);
      const manager = await this.requireManager(tx, actor, from.organizationId);
      if (manager.organizationRole !== "OWNER" || to.organizationId !== from.organizationId || to.status !== "ACTIVE") {
        throw new Error("PERMISSION_OWNERSHIP_TRANSFER_DENIED");
      }
      await tx.membership.update({ where: { id: to.id }, data: { organizationRole: "OWNER" } });
      await tx.membership.update({ where: { id: from.id }, data: { organizationRole: null } });
    });
  }

  async assignWorkspaceRole(actor: ExternalActor, membershipId: string, workspaceId: string, role: Role): Promise<void> {
    await this.assignScopedRole(actor, membershipId, { type: "WORKSPACE", id: workspaceId }, role);
  }

  async assignBrandRole(actor: ExternalActor, membershipId: string, brandId: string, role: Role): Promise<void> {
    await this.assignScopedRole(actor, membershipId, { type: "BRAND", id: brandId }, role);
  }

  private async assignScopedRole(actor: ExternalActor, membershipId: string, targetScope: TenantTarget, role: Role): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const target = await this.requireTarget(tx, membershipId);
      const manager = await this.requireScopedManager(tx, actor, target.organizationId, targetScope);
      if (manager.id === target.id) throw new Error("PERMISSION_SELF_ELEVATION_DENIED");
      if (target.status !== "ACTIVE" || !NON_GOVERNANCE_ROLES.includes(role)) throw new Error("PERMISSION_ROLE_ASSIGNMENT_DENIED");
      const ancestry = await resolveTarget(tx, targetScope);
      if (!ancestry || ancestry.organizationId !== target.organizationId) throw new Error("TENANT_INVALID_ANCESTRY");
      if (targetScope.type === "WORKSPACE") {
        await tx.workspaceRoleBinding.upsert({
          where: { membershipId_workspaceId: { membershipId, workspaceId: targetScope.id } },
          update: { role, status: "ACTIVE" },
          create: { id: `wrb_${randomUUID()}`, membershipId, organizationId: target.organizationId, workspaceId: targetScope.id, role },
        });
      } else {
        await tx.brandRoleBinding.upsert({
          where: { membershipId_brandId: { membershipId, brandId: targetScope.id } },
          update: { role, status: "ACTIVE", workspaceId: ancestry.workspaceId! },
          create: { id: `brb_${randomUUID()}`, membershipId, organizationId: target.organizationId, workspaceId: ancestry.workspaceId!, brandId: targetScope.id, role },
        });
      }
    });
  }

  private async requireScopedManager(db: Database, actor: ExternalActor, organizationId: string, targetScope: TenantTarget) {
    const identity = await resolveActor(db, actor);
    if (!identity || identity.userIdentity.status !== "ACTIVE") throw new Error("PERMISSION_DENIED");
    const membership = await db.membership.findUnique({
      where: { userIdentityId_organizationId: { userIdentityId: identity.userIdentityId, organizationId } },
    });
    if (!membership || membership.status !== "ACTIVE") throw new Error("PERMISSION_DENIED");
    if (["OWNER", "ADMIN"].includes(membership.organizationRole ?? "")) return membership;
    const ancestry = await resolveTarget(db, targetScope);
    if (!ancestry || ancestry.organizationId !== organizationId) throw new Error("TENANT_INVALID_ANCESTRY");
    const workspaceAdmin = ancestry.workspaceId && await db.workspaceRoleBinding.findFirst({
      where: { membershipId: membership.id, workspaceId: ancestry.workspaceId, role: "ADMIN", status: "ACTIVE" },
    });
    const brandAdmin = ancestry.brandId && await db.brandRoleBinding.findFirst({
      where: { membershipId: membership.id, brandId: ancestry.brandId, role: "ADMIN", status: "ACTIVE" },
    });
    if (!workspaceAdmin && !brandAdmin) throw new Error("PERMISSION_DENIED");
    return membership;
  }
}

export class PrismaTenantLifecycleService {
  private readonly access: PrismaTenantAccess;

  constructor(private readonly db: PrismaClient) {
    this.access = new PrismaTenantAccess(db);
  }

  async archive(actor: ExternalActor, target: TenantTarget): Promise<void> {
    await this.change(actor, target, "ARCHIVED");
  }

  async reactivate(actor: ExternalActor, target: TenantTarget): Promise<void> {
    await this.change(actor, target, "ACTIVE");
  }

  private async change(actor: ExternalActor, target: TenantTarget, status: "ACTIVE" | "ARCHIVED"): Promise<void> {
    const capability: Capability = `${target.type.toLowerCase()}.lifecycle.manage` as Capability;
    const decision = await this.access.authorize(actor, target, capability);
    if (!decision.allowed) throw new Error(`PERMISSION_DENIED:${decision.reason}`);
    const data = { status, archivedAt: status === "ARCHIVED" ? new Date() : null };
    if (target.type === "ORGANIZATION") await this.db.organization.update({ where: { id: target.id }, data });
    if (target.type === "WORKSPACE") await this.db.workspace.update({ where: { id: target.id }, data });
    if (target.type === "BRAND") await this.db.brand.update({ where: { id: target.id }, data });
  }
}

export class PrismaScopedRelationGuard {
  constructor(private readonly db: PrismaClient) {}

  async assertPillar(organizationId: string, brandId: string, pillarId: string): Promise<void> {
    const found = await this.db.contentPillar.count({ where: { id: pillarId, organizationId, brandId } });
    if (found !== 1) throw new Error("TENANT_FOREIGN_RELATION");
  }

  async assertFacebookAccount(organizationId: string, brandId: string, accountId: string): Promise<void> {
    const found = await this.db.facebookAccount.count({ where: { id: accountId, organizationId, brandId } });
    if (found !== 1) throw new Error("TENANT_FOREIGN_RELATION");
  }
}
