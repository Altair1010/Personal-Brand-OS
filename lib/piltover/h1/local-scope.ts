import { db } from "@/lib/db";
import { runP2Backfill } from "@/lib/piltover/modules/platform/infrastructure/p2-backfill";

const USER_ID = "local";

export type LocalPiltoverScope = {
  userId: string;
  organizationId: string;
  workspaceId: string;
  brandId: string;
  brandName: string;
};

export async function resolveLocalPiltoverScope(): Promise<LocalPiltoverScope> {
  const profile = await db.userProfile.findUnique({
    where: { id: USER_ID },
    select: { id: true, userIdentityId: true },
  });

  if (!profile) throw new Error("LOCAL_PROFILE_MISSING");

  if (!profile.userIdentityId) {
    await runP2Backfill(db);
  }

  const scopedDna = await db.brandDNA.findUnique({
    where: { userId: USER_ID },
    select: { organizationId: true, brandId: true },
  });
  if (!scopedDna?.organizationId || !scopedDna.brandId) {
    await runP2Backfill(db);
  }

  const brandDna = await db.brandDNA.findUniqueOrThrow({
    where: { userId: USER_ID },
    select: { organizationId: true, brandId: true },
  });

  if (!brandDna.organizationId || !brandDna.brandId) {
    throw new Error("LOCAL_TENANT_SCOPE_MISSING");
  }

  const brand = await db.brand.findUniqueOrThrow({
    where: { id: brandDna.brandId },
    select: { id: true, organizationId: true, workspaceId: true, name: true },
  });

  if (brand.organizationId !== brandDna.organizationId) {
    throw new Error("LOCAL_TENANT_SCOPE_MISMATCH");
  }

  return {
    userId: USER_ID,
    organizationId: brand.organizationId,
    workspaceId: brand.workspaceId,
    brandId: brand.id,
    brandName: brand.name,
  };
}
