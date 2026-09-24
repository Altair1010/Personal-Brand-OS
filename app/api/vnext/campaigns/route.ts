import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createExecutionCampaign, transitionExecutionCampaign } from "@/lib/piltover/vnext/campaign-service";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET() {
  const tenant = await resolveLocalTenant(db);
  const data = await db.marketingCampaign.findMany({ where: { organizationId: tenant.organizationId, workspaceId: tenant.workspaceId, brandId: tenant.brandId }, orderBy: { updatedAt: "desc" } });
  return NextResponse.json({ ok: true, data });
}
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "BODY_REQUIRED" }, { status: 400 });
  try {
    const data = body.action === "transition"
      ? await transitionExecutionCampaign(db, String(body.campaignId || ""), String(body.status || "") as never)
      : await createExecutionCampaign(db, body.input as never);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "CAMPAIGN_FAILED" }, { status: 400 });
  }
}
