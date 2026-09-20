import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export type LocalTenant = {
  organizationId: string;
  workspaceId: string;
  brandId: string;
};

export async function resolveLocalTenant(db: Db): Promise<LocalTenant> {
  const dna = await db.brandDNA.findUnique({
    where: { userId: "local" },
    select: {
      organizationId: true,
      brandId: true,
      brand: { select: { workspaceId: true, status: true } },
    },
  });
  if (!dna?.organizationId || !dna.brandId || !dna.brand) {
    throw new Error("H1_TENANT_SCOPE_REQUIRED");
  }
  if (dna.brand.status !== "ACTIVE") {
    throw new Error("H1_BRAND_NOT_ACTIVE");
  }
  return {
    organizationId: dna.organizationId,
    workspaceId: dna.brand.workspaceId,
    brandId: dna.brandId,
  };
}
