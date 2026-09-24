import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ ok: true, data: [] });
  const tenant = await resolveLocalTenant(db);
  const [campaigns, drafts, experiments, recommendations, threads, evidence] = await Promise.all([
    db.marketingCampaign.findMany({
      where: { organizationId: tenant.organizationId, brandId: tenant.brandId, name: { contains: q } },
      select: { id: true, name: true, status: true },
      take: 8,
    }),
    db.contentDraft.findMany({
      where: {
        organizationId: tenant.organizationId,
        brandId: tenant.brandId,
        OR: [{ topic: { contains: q } }, { description: { contains: q } }, { notes: { contains: q } }],
      },
      select: { id: true, topic: true, status: true },
      take: 8,
    }),
    db.experiment.findMany({
      where: { organizationId: tenant.organizationId, brandId: tenant.brandId, hypothesis: { contains: q } },
      select: { id: true, hypothesis: true, status: true },
      take: 8,
    }),
    db.recommendation.findMany({
      where: {
        organizationId: tenant.organizationId,
        brandId: tenant.brandId,
        OR: [{ title: { contains: q } }, { rationale: { contains: q } }],
      },
      select: { id: true, title: true, status: true },
      take: 8,
    }),
    db.agentThread.findMany({
      where: { organizationId: tenant.organizationId, workspaceId: tenant.workspaceId, brandId: tenant.brandId, id: { contains: q } },
      select: { id: true, status: true },
      take: 8,
    }),
    db.evidence.findMany({
      where: {
        organizationId: tenant.organizationId,
        brandId: tenant.brandId,
        OR: [{ sourceType: { contains: q } }, { sourceRef: { contains: q } }],
      },
      select: { id: true, sourceType: true, sourceRef: true },
      take: 8,
    }),
  ]);

  const data = [
    ...campaigns.map((item) => ({ type: "campaign", id: item.id, label: item.name, meta: item.status, href: "/campaigns" })),
    ...drafts.map((item) => ({ type: "content", id: item.id, label: item.topic || "Untitled draft", meta: item.status, href: `/studio/${item.id}` })),
    ...experiments.map((item) => ({ type: "experiment", id: item.id, label: item.hypothesis, meta: item.status, href: "/experiments" })),
    ...recommendations.map((item) => ({ type: "recommendation", id: item.id, label: item.title, meta: item.status, href: "/review" })),
    ...threads.map((item) => ({ type: "thread", id: item.id, label: item.id, meta: item.status, href: "/agents" })),
    ...evidence.map((item) => ({ type: "evidence", id: item.id, label: item.sourceRef || item.sourceType, meta: item.sourceType, href: "/knowledge" })),
  ].slice(0, 24);
  return NextResponse.json({ ok: true, data });
}
