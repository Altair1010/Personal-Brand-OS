import { BrainCircuit, Database, FileSearch } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { syncMarketingProjectContext } from "@/lib/piltover/vnext/project-context-service";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const tenant = await resolveLocalTenant(db);
  const context = await syncMarketingProjectContext(db);
  const [evidence, imported] = await Promise.all([
    db.evidence.findMany({ where: { organizationId: tenant.organizationId, brandId: tenant.brandId }, orderBy: { capturedAt: "desc" }, take: 25 }),
    db.importedPattern.findMany({ orderBy: { importedAt: "desc" }, take: 25 }),
  ]);

  return (
    <>
      <PageHeader title="Knowledge" description="Project context, evidence and provenance used by Piltover engines and agents." />
      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardContent className="py-4"><BrainCircuit className="size-4 text-muted-foreground" /><div className="mt-3 font-mono text-xl">v{context.version}</div><div className="text-xs text-muted-foreground">Project context</div></CardContent></Card>
        <Card><CardContent className="py-4"><Database className="size-4 text-muted-foreground" /><div className="mt-3 font-mono text-xl">{evidence.length}</div><div className="text-xs text-muted-foreground">Recent evidence records</div></CardContent></Card>
        <Card><CardContent className="py-4"><FileSearch className="size-4 text-muted-foreground" /><div className="mt-3 font-mono text-xl">{imported.length}</div><div className="text-xs text-muted-foreground">Imported patterns tracked</div></CardContent></Card>
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card><CardContent className="py-4">
          <h2 className="mb-3 text-sm font-semibold">MarketingProjectContext</h2>
          <pre className="max-h-[520px] overflow-auto rounded-lg border bg-[hsl(var(--surface-2))] p-3 text-[11px] leading-5">
            {JSON.stringify({ brand: context.brand, audiences: context.audiences, objectives: context.objectives, channels: context.channels, campaign: context.campaign, seo: context.seo, measurement: context.measurement }, null, 2)}
          </pre>
        </CardContent></Card>
        <Card><CardContent className="py-4">
          <h2 className="mb-3 text-sm font-semibold">Evidence</h2>
          <div className="space-y-2">
            {evidence.map((item) => (
              <details key={item.id} className="rounded-lg border bg-[hsl(var(--surface-1))]">
                <summary className="cursor-pointer list-none p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium">{item.sourceType}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{item.capturedAt.toISOString()}</span>
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-muted-foreground">{item.sourceRef ?? item.id}</div>
                  <div className="mt-2 line-clamp-2 text-xs text-muted-foreground">{JSON.stringify(item.content)}</div>
                </summary>
                <div className="border-t p-3">
                  <div className="mb-2 text-[11px] text-muted-foreground">confidence {item.confidence ?? "—"} · freshness {item.freshness ?? "—"}</div>
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-[hsl(var(--surface-2))] p-3 text-[11px]">{JSON.stringify({ content: item.content, metadata: item.metadata }, null, 2)}</pre>
                </div>
              </details>
            ))}
            {evidence.length === 0 && <p className="text-sm text-muted-foreground">No evidence captured yet.</p>}
          </div>
        </CardContent></Card>
      </div>
    </>
  );
}
