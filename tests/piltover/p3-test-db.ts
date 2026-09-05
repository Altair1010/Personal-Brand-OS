import type { PrismaClient } from "@prisma/client";
import { createDisposableP2Database, type DisposableP2Database } from "./p2-test-db";

export interface P3Fixture {
  readonly database: DisposableP2Database;
  readonly db: PrismaClient;
  readonly ownerActor: { readonly provider: string; readonly subject: string };
  readonly foreignActor: { readonly provider: string; readonly subject: string };
}

export async function createP3Fixture(): Promise<P3Fixture> {
  const database = await createDisposableP2Database();
  const db = database.client;

  await db.userIdentity.createMany({
    data: [
      { id: "identity-owner" },
      { id: "identity-foreign" },
    ],
  });
  await db.authIdentity.createMany({
    data: [
      { id: "auth-owner", userIdentityId: "identity-owner", provider: "test", subject: "owner" },
      { id: "auth-foreign", userIdentityId: "identity-foreign", provider: "test", subject: "foreign" },
    ],
  });
  await db.organization.createMany({
    data: [
      { id: "org-a", name: "Organization A" },
      { id: "org-b", name: "Organization B" },
    ],
  });
  await db.workspace.createMany({
    data: [
      { id: "workspace-a", organizationId: "org-a", name: "Workspace A" },
      { id: "workspace-a2", organizationId: "org-a", name: "Workspace A2" },
      { id: "workspace-b", organizationId: "org-b", name: "Workspace B" },
    ],
  });
  await db.brand.createMany({
    data: [
      { id: "brand-a1", organizationId: "org-a", workspaceId: "workspace-a", name: "Brand A1" },
      { id: "brand-a2", organizationId: "org-a", workspaceId: "workspace-a", name: "Brand A2" },
      { id: "brand-b1", organizationId: "org-b", workspaceId: "workspace-b", name: "Brand B1" },
    ],
  });
  await db.membership.createMany({
    data: [
      {
        id: "membership-owner",
        userIdentityId: "identity-owner",
        organizationId: "org-a",
        organizationRole: "OWNER",
      },
      {
        id: "membership-foreign",
        userIdentityId: "identity-foreign",
        organizationId: "org-b",
        organizationRole: "OWNER",
      },
    ],
  });

  return {
    database,
    db,
    ownerActor: { provider: "test", subject: "owner" },
    foreignActor: { provider: "test", subject: "foreign" },
  };
}
