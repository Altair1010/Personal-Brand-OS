import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { saveStructuredStrategy } from "@/lib/piltover/vnext/strategy-service";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const tenant = await resolveLocalTenant(db);
  const rows = await db.strategyVersion.findMany({
    where: { strategy: { organizationId: tenant.organizationId, brandId: tenant.brandId } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ ok: true, data: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as null | { strategyVersionId?: string; structured?: unknown };
  if (!body?.strategyVersionId || !body.structured || typeof body.structured !== "object") {
    return NextResponse.json({ ok: false, error: "STRUCTURED_STRATEGY_REQUIRED" }, { status: 400 });
  }
  try {
    const data = await saveStructuredStrategy(db, body.strategyVersionId, body.structured as never);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "STRATEGY_SAVE_FAILED" }, { status: 400 });
  }
}
