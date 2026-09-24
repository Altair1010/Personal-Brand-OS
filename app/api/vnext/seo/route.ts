import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { persistAiVisibility, persistSeoAudit, persistSeoResearch } from "@/lib/piltover/vnext/seo-engine";
import { syncSearchConsoleResource } from "@/lib/piltover/vnext/search-console-sync";
import { syncFreshness } from "@/lib/piltover/vnext/live-data-engine";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const tenant = await resolveLocalTenant(db);
  const [audits, research, visibility, syncStates] = await Promise.all([
    db.sEOAuditSnapshot.findMany({ where: { organizationId: tenant.organizationId, brandId: tenant.brandId }, orderBy: { capturedAt: "desc" }, take: 50 }),
    db.sEOResearchArtifact.findMany({ where: { organizationId: tenant.organizationId, brandId: tenant.brandId }, orderBy: { capturedAt: "desc" }, take: 50 }),
    db.aIVisibilitySnapshot.findMany({ where: { organizationId: tenant.organizationId, brandId: tenant.brandId }, orderBy: { capturedAt: "desc" }, take: 50 }),
    db.dataSyncState.findMany({ where: { organizationId: tenant.organizationId, brandId: tenant.brandId, provider: "GOOGLE_SEARCH_CONSOLE" }, orderBy: { updatedAt: "desc" } }),
  ]);
  return NextResponse.json({ ok: true, data: { audits, research, visibility, syncStates: syncStates.map((row) => ({ ...row, freshness: syncFreshness(row) })) } });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as null | Record<string, unknown>;
  if (!body) return NextResponse.json({ ok: false, error: "BODY_REQUIRED" }, { status: 400 });
  try {
    const tenant = await resolveLocalTenant(db);
    if (body.action === "search-console-sync") {
      const connectionId = String(body.connectionId || "");
      const resourceId = String(body.resourceId || "");
      const startDate = String(body.startDate || "");
      const endDate = String(body.endDate || "");
      if (!connectionId || !resourceId || !startDate || !endDate) throw new Error("SEARCH_SYNC_INPUT_REQUIRED");
      const data = await syncSearchConsoleResource(db, { connectionId, resourceId, startDate, endDate });
      return NextResponse.json({ ok: true, data });
    }
    if (body.action === "research") {
      const data = await persistSeoResearch(db, {
        organizationId: tenant.organizationId, brandId: tenant.brandId,
        kind: String(body.kind || "keyword"), query: typeof body.query === "string" ? body.query : undefined,
        provider: String(body.provider || "manual"), data: body.data ?? {},
        evidenceRefs: Array.isArray(body.evidenceRefs) ? body.evidenceRefs.filter((x): x is string => typeof x === "string") : [],
      });
      return NextResponse.json({ ok: true, data });
    }
    if (body.action === "ai-visibility") {
      const data = await persistAiVisibility(db, {
        organizationId: tenant.organizationId, brandId: tenant.brandId,
        provider: String(body.provider || "manual"), promptSet: body.promptSet ?? [],
        brandMentions: body.brandMentions ?? [], sourceMentions: body.sourceMentions ?? [],
        competitorMentions: body.competitorMentions ?? [], citedPages: body.citedPages ?? [],
      });
      return NextResponse.json({ ok: true, data });
    }
    if (typeof body.domain !== "string" || !body.signals) throw new Error("DOMAIN_AND_SIGNALS_REQUIRED");
    const data = await persistSeoAudit(db, {
      organizationId: tenant.organizationId,
      brandId: tenant.brandId,
      domain: body.domain,
      signals: body.signals as never,
      source: typeof body.source === "string" ? body.source : "manual",
    });
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "SEO_AUDIT_FAILED" }, { status: 400 });
  }
}
