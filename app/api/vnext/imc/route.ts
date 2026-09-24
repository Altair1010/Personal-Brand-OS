import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createImcPlanVersion } from "@/lib/piltover/vnext/imc-service";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const tenant = await resolveLocalTenant(db);
  const data = await db.iMCPlan.findMany({
    where: { organizationId: tenant.organizationId, workspaceId: tenant.workspaceId, brandId: tenant.brandId },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ ok: true, data });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "BODY_REQUIRED" }, { status: 400 });
  try {
    const data = await createImcPlanVersion(db, body as never);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "IMC_CREATE_FAILED" }, { status: 400 });
  }
}
