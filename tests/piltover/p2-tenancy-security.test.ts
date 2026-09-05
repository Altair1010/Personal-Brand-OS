import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runP2Backfill } from "@/lib/piltover/modules/platform/infrastructure/p2-backfill";
import {
  PrismaMembershipService,
  PrismaScopedRelationGuard,
  PrismaTenantAccess,
  PrismaTenantLifecycleService,
} from "@/lib/piltover/modules/identity/infrastructure/prisma-tenant-access";
import {
  createDisposableP2Database,
  type DisposableP2Database,
} from "@/tests/piltover/p2-test-db";

let database: DisposableP2Database;

beforeEach(async () => {
  database = await createDisposableP2Database();
  const db = database.client;
  await db.appState.create({ data: { id: "singleton", supabaseUserId: "owner-a" } });
  await db.userProfile.createMany({
    data: [
      { id: "local", name: "Owner A" },
      { id: "owner-b", name: "Owner B" },
    ],
  });
  await runP2Backfill(db);

  const ownerB = await db.userProfile.findUniqueOrThrow({ where: { id: "owner-b" } });
  await db.authIdentity.create({
    data: {
      id: "auth-owner-b",
      userIdentityId: ownerB.userIdentityId!,
      provider: "supabase",
      subject: "owner-b",
    },
  });
}, 120_000);

afterEach(async () => {
  if (database) await database.dispose();
});

async function tenantForProfile(profileId: string) {
  const profile = await database.client.userProfile.findUniqueOrThrow({
    where: { id: profileId },
    include: { identity: { include: { memberships: true } } },
  });
  const membership = profile.identity!.memberships[0];
  const organization = await database.client.organization.findUniqueOrThrow({
    where: { id: membership.organizationId },
    include: { workspaces: { include: { brands: true } } },
  });
  return {
    identityId: profile.identity!.id,
    membership,
    organization,
    workspace: organization.workspaces[0],
    brand: organization.workspaces[0].brands[0],
  };
}

describe("tenant access resolves ancestry server-side", () => {
  it("allows own Organization, Workspace, and Brand but denies foreign and missing context", async () => {
    const a = await tenantForProfile("local");
    const b = await tenantForProfile("owner-b");
    const access = new PrismaTenantAccess(database.client);

    await expect(
      access.authorize({ provider: "supabase", subject: "owner-a" }, { type: "ORGANIZATION", id: a.organization.id }, "organization.read"),
    ).resolves.toMatchObject({ allowed: true });
    await expect(
      access.authorize({ provider: "supabase", subject: "owner-a" }, { type: "WORKSPACE", id: a.workspace.id }, "workspace.read"),
    ).resolves.toMatchObject({ allowed: true });
    await expect(
      access.authorize({ provider: "supabase", subject: "owner-a" }, { type: "BRAND", id: a.brand.id }, "brand.read"),
    ).resolves.toMatchObject({ allowed: true });
    await expect(
      access.authorize({ provider: "supabase", subject: "owner-a" }, { type: "BRAND", id: b.brand.id }, "brand.read"),
    ).resolves.toEqual({ allowed: false, reason: "MISSING_MEMBERSHIP" });
    await expect(
      access.authorize({ provider: "supabase", subject: "owner-a" }, null, "brand.read"),
    ).resolves.toEqual({ allowed: false, reason: "MISSING_TENANT" });
  });

  it("returns only exact scoped PromptRuns", async () => {
    const a = await tenantForProfile("local");
    const b = await tenantForProfile("owner-b");
    await database.client.promptRun.createMany({
      data: [
        { id: "run-a", moduleKey: "x", provider: "x", model: "x", organizationId: a.organization.id, brandId: a.brand.id },
        { id: "run-b", moduleKey: "x", provider: "x", model: "x", organizationId: b.organization.id, brandId: b.brand.id },
        { id: "run-unscoped", moduleKey: "x", provider: "x", model: "x" },
      ],
    });
    const access = new PrismaTenantAccess(database.client);
    const runs = await access.listPromptRuns(
      { provider: "supabase", subject: "owner-a" },
      { organizationId: a.organization.id, brandId: a.brand.id },
    );
    expect(runs.map((run) => run.id)).toEqual(["run-a"]);

    const created = await access.createPromptRun(
      { provider: "supabase", subject: "owner-a" },
      { organizationId: a.organization.id, brandId: a.brand.id },
      { id: "run-new", moduleKey: "x", provider: "x", model: "x" },
    );
    expect([created.organizationId, created.brandId]).toEqual([a.organization.id, a.brand.id]);
    await expect(access.createPromptRun(
      { provider: "supabase", subject: "owner-a" },
      { organizationId: a.organization.id, brandId: b.brand.id },
      { id: "run-foreign", moduleKey: "x", provider: "x", model: "x" },
    )).rejects.toThrow("PERMISSION_DENIED");
  });
});

describe("membership temporal security", () => {
  it("suspends without clearing grants and resume restores them", async () => {
    const a = await tenantForProfile("local");
    const service = new PrismaMembershipService(database.client);
    await database.client.userIdentity.create({
      data: {
        id: "suspended-member-a",
        memberships: { create: { id: "suspended-membership-a", organizationId: a.organization.id, organizationRole: "MANAGER" } },
      },
    });
    await service.suspend({ provider: "supabase", subject: "owner-a" }, "suspended-membership-a");
    expect(await database.client.membership.findUniqueOrThrow({ where: { id: "suspended-membership-a" } }))
      .toMatchObject({ status: "SUSPENDED", organizationRole: "MANAGER" });
    await service.resume({ provider: "supabase", subject: "owner-a" }, "suspended-membership-a");
    expect((await database.client.membership.findUniqueOrThrow({ where: { id: "suspended-membership-a" } })).status)
      .toBe("ACTIVE");
  });

  it("revokes all grants atomically and readmission starts with zero grants", async () => {
    const a = await tenantForProfile("local");
    const service = new PrismaMembershipService(database.client);
    const member = await database.client.userIdentity.create({
      data: {
        id: "member-a",
        authIdentities: { create: { id: "auth-member-a", provider: "supabase", subject: "member-a" } },
        memberships: {
          create: {
            id: "membership-a",
            organizationId: a.organization.id,
            organizationRole: "MANAGER",
          },
        },
      },
    });
    await database.client.workspaceRoleBinding.create({
      data: {
        id: "workspace-binding-a",
        membershipId: "membership-a",
        organizationId: a.organization.id,
        workspaceId: a.workspace.id,
        role: "EDITOR",
      },
    });
    await database.client.brandRoleBinding.create({
      data: {
        id: "brand-binding-a",
        membershipId: "membership-a",
        organizationId: a.organization.id,
        workspaceId: a.workspace.id,
        brandId: a.brand.id,
        role: "EDITOR",
      },
    });
    expect(member.id).toBe("member-a");

    await service.revoke({ provider: "supabase", subject: "owner-a" }, "membership-a");
    expect(await database.client.membership.findUniqueOrThrow({ where: { id: "membership-a" } }))
      .toMatchObject({ status: "REVOKED", organizationRole: null });
    expect(await database.client.workspaceRoleBinding.findUniqueOrThrow({ where: { id: "workspace-binding-a" } }))
      .toMatchObject({ status: "REVOKED" });
    expect(await database.client.brandRoleBinding.findUniqueOrThrow({ where: { id: "brand-binding-a" } }))
      .toMatchObject({ status: "REVOKED" });

    await expect(service.resume({ provider: "supabase", subject: "owner-a" }, "membership-a"))
      .rejects.toThrow("TENANT_READMISSION_REQUIRED");
    await service.readmit({ provider: "supabase", subject: "owner-a" }, "membership-a");
    expect(await database.client.membership.findUniqueOrThrow({ where: { id: "membership-a" } }))
      .toMatchObject({ status: "ACTIVE", organizationRole: null });
  });

  it("prevents loss of the last active Owner", async () => {
    const a = await tenantForProfile("local");
    const service = new PrismaMembershipService(database.client);
    await expect(service.suspend({ provider: "supabase", subject: "owner-a" }, a.membership.id))
      .rejects.toThrow("PERMISSION_LAST_OWNER_REQUIRED");
    await expect(service.revoke({ provider: "supabase", subject: "owner-a" }, a.membership.id))
      .rejects.toThrow("PERMISSION_LAST_OWNER_REQUIRED");
  });

  it("enforces assignment ceilings and blocks self-elevation", async () => {
    const a = await tenantForProfile("local");
    const service = new PrismaMembershipService(database.client);
    await database.client.userIdentity.create({
      data: {
        id: "admin-a",
        authIdentities: { create: { id: "auth-admin-a", provider: "supabase", subject: "admin-a" } },
        memberships: { create: { id: "membership-admin-a", organizationId: a.organization.id, organizationRole: "ADMIN" } },
      },
    });
    await database.client.userIdentity.create({
      data: {
        id: "target-a",
        memberships: { create: { id: "membership-target-a", organizationId: a.organization.id } },
      },
    });

    await expect(
      service.assignOrganizationRole({ provider: "supabase", subject: "admin-a" }, "membership-target-a", "OWNER"),
    ).rejects.toThrow("PERMISSION_ROLE_ASSIGNMENT_DENIED");
    await expect(
      service.assignOrganizationRole({ provider: "supabase", subject: "admin-a" }, "membership-admin-a", "OWNER"),
    ).rejects.toThrow("PERMISSION_SELF_ELEVATION_DENIED");
    await service.assignOrganizationRole(
      { provider: "supabase", subject: "owner-a" },
      "membership-target-a",
      "ADMIN",
    );
    expect((await database.client.membership.findUniqueOrThrow({ where: { id: "membership-target-a" } })).organizationRole)
      .toBe("ADMIN");
    await service.transferOwnership(
      { provider: "supabase", subject: "owner-a" },
      a.membership.id,
      "membership-target-a",
    );
    expect(await database.client.membership.findMany({
      where: { organizationId: a.organization.id, status: "ACTIVE", organizationRole: "OWNER" },
    })).toHaveLength(1);
  });
});

describe("tenant lifecycle and relation integrity", () => {
  it("keeps Workspace lifecycle distinct and rejects Brand-only authority", async () => {
    const a = await tenantForProfile("local");
    const lifecycle = new PrismaTenantLifecycleService(database.client);
    await lifecycle.archive({ provider: "supabase", subject: "owner-a" }, { type: "WORKSPACE", id: a.workspace.id });
    expect((await database.client.workspace.findUniqueOrThrow({ where: { id: a.workspace.id } })).status).toBe("ARCHIVED");
    await lifecycle.reactivate({ provider: "supabase", subject: "owner-a" }, { type: "WORKSPACE", id: a.workspace.id });

    await database.client.userIdentity.create({
      data: {
        id: "brand-admin-a",
        authIdentities: { create: { id: "auth-brand-admin-a", provider: "supabase", subject: "brand-admin-a" } },
        memberships: { create: { id: "membership-brand-admin-a", organizationId: a.organization.id } },
      },
    });
    await database.client.brandRoleBinding.create({
      data: { id: "brand-admin-binding", membershipId: "membership-brand-admin-a", organizationId: a.organization.id, workspaceId: a.workspace.id, brandId: a.brand.id, role: "ADMIN" },
    });
    await expect(lifecycle.archive({ provider: "supabase", subject: "brand-admin-a" }, { type: "WORKSPACE", id: a.workspace.id }))
      .rejects.toThrow("PERMISSION_DENIED");
  });

  it("rejects foreign Pillar and provider connection injection", async () => {
    const a = await tenantForProfile("local");
    const b = await tenantForProfile("owner-b");
    const foreignPillar = await database.client.contentPillar.create({ data: { id: "foreign-pillar", userId: "owner-b", name: "Foreign", organizationId: b.organization.id, brandId: b.brand.id } });
    const foreignAccount = await database.client.facebookAccount.create({ data: { id: "foreign-account", ownerRef: "owner-b", pageId: "page-b", pageName: "B", accessToken: "encrypted", organizationId: b.organization.id, brandId: b.brand.id } });
    const guard = new PrismaScopedRelationGuard(database.client);
    await expect(guard.assertPillar(a.organization.id, a.brand.id, foreignPillar.id)).rejects.toThrow("TENANT_FOREIGN_RELATION");
    await expect(guard.assertFacebookAccount(a.organization.id, a.brand.id, foreignAccount.id)).rejects.toThrow("TENANT_FOREIGN_RELATION");
  });
});
