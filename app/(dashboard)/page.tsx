import Link from "next/link";
import {
  Activity, AlertTriangle, Bot, CalendarClock, CheckCircle2, FlaskConical,
  Lightbulb, Megaphone, ShieldCheck, Sparkles,
} from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";

export const dynamic = "force-dynamic";

const ACTIVE_RUNS = ["WAITING_FOR_WORKER", "CLAIMED", "RUNNING", "WAITING_APPROVAL", "RETRY_PENDING"];

function statusVariant(status: string) {
  if (["COMPLETED", "ACTIVE", "APPROVED", "PUBLISHED", "PASS"].includes(status)) return "default" as const;
  if (["FAILED", "BLOCKED", "REJECTED"].includes(status)) return "destructive" as const;
  return "secondary" as const;
}

export default async function CommandCenterPage() {
  const tenant = await resolveLocalTenant(db);
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const [
    activeRuns,
    recentRuns,
    pendingApprovals,
    campaigns,
    publishing,
    experiments,
    recommendations,
    evidence,
    drafts,
  ] = await Promise.all([
    db.agentRun.count({
      where: { brandId: tenant.brandId, status: { in: ACTIVE_RUNS } },
    }),
    db.agentRun.findMany({
      where: { brandId: tenant.brandId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, status: true, roleRef: true, modelRef: true, traceId: true, createdAt: true },
    }),
    db.approvalRequest.findMany({
      where: { organizationId: tenant.organizationId, status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 8,
    }),
    db.marketingCampaign.findMany({
      where: { organizationId: tenant.organizationId, brandId: tenant.brandId },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: { id: true, name: true, objective: true, status: true, startsAt: true, endsAt: true },
    }),
    db.publishingJob.findMany({
      where: {
        organizationId: tenant.organizationId,
        brandId: tenant.brandId,
        status: { in: ["QUEUED", "SCHEDULED", "RUNNING", "FAILED"] },
      },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
      take: 8,
    }),
    db.experiment.findMany({
      where: { organizationId: tenant.organizationId, brandId: tenant.brandId, status: { not: "ARCHIVED" } },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    db.recommendation.findMany({
      where: { organizationId: tenant.organizationId, brandId: tenant.brandId, status: "PROPOSED" },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    db.evidence.findMany({
      where: { organizationId: tenant.organizationId, brandId: tenant.brandId },
      orderBy: { capturedAt: "desc" },
      take: 6,
    }),
    db.contentDraft.count({ where: { organizationId: tenant.organizationId, brandId: tenant.brandId } }),
  ]);

  const dueSoon = publishing.filter((item) =>
    item.scheduledAt && item.scheduledAt >= now && item.scheduledAt <= tomorrow,
  ).length;
  const activeCampaigns = campaigns.filter((item) => ["READY", "ACTIVE", "PAUSED"].includes(item.status)).length;
  const runningExperiments = experiments.filter((item) => ["READY", "RUNNING", "PAUSED"].includes(item.status)).length;
  const summaryCards = [
    { label: "Agent activity", value: activeRuns, Icon: Bot, href: "/agents" },
    { label: "Pending approvals", value: pendingApprovals.length, Icon: ShieldCheck, href: "/review" },
    { label: "Publishing <24h", value: dueSoon, Icon: CalendarClock, href: "/calendar" },
    { label: "Recommendations", value: recommendations.length, Icon: Lightbulb, href: "/review" },
  ];

  return (
    <>
      <PageHeader
        title="Command Center"
        description="Operational view of what is running, what needs attention, what changed, and what Piltover recommends next."
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(({ label, value, Icon, href }) => (
          <Link href={href} key={label}>
            <Card className="h-full transition-colors hover:border-primary/60">
              <CardContent className="py-4">
                <Icon className="size-4 text-muted-foreground" />
                <div className="mt-4 font-mono text-2xl">{value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{label}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.05fr_1fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="size-4" /> Needs attention
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingApprovals.map((item) => (
              <Link href="/review" key={item.id} className="block rounded-lg border bg-[hsl(var(--surface-2))] p-3 hover:border-primary/50">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{item.actionType}</span>
                  <Badge variant="secondary">Approval</Badge>
                </div>
                <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground">{item.targetRef}</div>
              </Link>
            ))}
            {publishing.filter((item) => item.status === "FAILED").map((item) => (
              <Link href="/campaigns" key={item.id} className="block rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">Publishing failed</span>
                  <Badge variant="destructive">FAILED</Badge>
                </div>
                <div className="mt-1 truncate text-xs text-muted-foreground">{item.error ?? item.integrationId}</div>
              </Link>
            ))}
            {pendingApprovals.length === 0 && publishing.every((item) => item.status !== "FAILED") && (
              <div className="flex min-h-28 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                <CheckCircle2 className="mr-2 size-4" /> No blocking action right now.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="size-4" /> Agent activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentRuns.map((run) => (
                <div key={run.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{run.roleRef}</div>
                    <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                      {run.id} · {run.modelRef ?? "configured"} · {run.traceId ?? "no-trace"}
                    </div>
                  </div>
                  <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
                </div>
              ))}
              {recentRuns.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No agent runs yet.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Megaphone className="size-4" /> Campaign pulse</CardTitle></CardHeader>
          <CardContent>
            <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{activeCampaigns} active/ready</Badge>
              <span>{drafts} content drafts</span>
            </div>
            <div className="space-y-2">
              {campaigns.slice(0, 5).map((item) => (
                <Link key={item.id} href="/campaigns" className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-accent/50">
                  <div className="min-w-0"><div className="truncate text-xs font-medium">{item.name}</div><div className="text-[10px] text-muted-foreground">{item.objective}</div></div>
                  <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><FlaskConical className="size-4" /> Experiments</CardTitle></CardHeader>
          <CardContent>
            <div className="mb-3 text-xs text-muted-foreground">{runningExperiments} ready/running/paused</div>
            <div className="space-y-2">
              {experiments.slice(0, 5).map((item) => (
                <Link key={item.id} href="/experiments" className="block rounded-md px-2 py-2 hover:bg-accent/50">
                  <div className="line-clamp-2 text-xs font-medium">{item.hypothesis}</div>
                  <div className="mt-1 flex items-center justify-between"><span className="font-mono text-[10px] text-muted-foreground">{item.primaryMetric}</span><Badge variant={statusVariant(item.status)}>{item.status}</Badge></div>
                </Link>
              ))}
              {experiments.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">No experiments yet.</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Sparkles className="size-4" /> Recent intelligence</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {evidence.map((item) => (
              <Link key={item.id} href="/knowledge" className="block rounded-md border p-2.5 hover:border-primary/50">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">{item.sourceType}</span>
                  <span className="font-mono text-[9px] text-muted-foreground">{item.capturedAt.toLocaleDateString()}</span>
                </div>
                <div className="mt-1 line-clamp-1 text-[10px] text-muted-foreground">{item.sourceRef ?? item.id}</div>
              </Link>
            ))}
            {evidence.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">No evidence captured yet.</p>}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
