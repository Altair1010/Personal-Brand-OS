import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const tenant = await resolveLocalTenant(db);
  const jobs = await db.publishingJob.findMany({
    where: { organizationId: tenant.organizationId, brandId: tenant.brandId },
    include: { deliveryAttempts: { orderBy: { attemptNumber: "desc" }, take: 5 } },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
  return NextResponse.json({ ok: true, data: jobs });
}
