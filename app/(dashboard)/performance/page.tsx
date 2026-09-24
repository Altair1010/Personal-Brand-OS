import { BarChart2, Database, FlaskConical, Sigma } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getPerformanceOverview, evaluateMeasurementEligibility } from "@/lib/piltover/vnext/measurement-engine";
import { EmptyState } from "@/components/EmptyState";
import { MetricInlineTable } from "@/components/performance/MetricInlineTable";
import { PerformanceCharts } from "@/components/performance/PerformanceCharts";
import { KpiSummary } from "@/components/performance/KpiSummary";
import { PillarPerfTable } from "@/components/performance/PillarPerfTable";
import { HookPerfTable } from "@/components/performance/HookPerfTable";
import { LatestInsightCard } from "@/components/performance/LatestInsightCard";
import { ConnectFacebookForm } from "@/components/performance/ConnectFacebookForm";
import { PaidPerformanceTable } from "@/components/performance/PaidPerformanceTable";
import { db } from "@/lib/db";
import {
  getAgentRuntimeStatus,
  getPaidPerformanceData,
  getPerformanceData,
  listFacebookAccounts,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ fb?: string }>;
}) {
  const { fb } = await searchParams;
  const [data, accounts, paid, agentRuntime, canonical] = await Promise.all([
    getPerformanceData(fb ?? null),
    listFacebookAccounts(),
    getPaidPerformanceData(),
    getAgentRuntimeStatus(),
    getPerformanceOverview(db, { limit: 150 }),
  ]);

  const periods = new Set(canonical.snapshots.map((row) => row.period));
  const channels = new Set(canonical.snapshots.filter((row) => row.entityType === "channel").map((row) => row.entityId));
  const serialized = canonical.snapshots.map((row) => JSON.stringify(row.metrics));
  const eligibility = evaluateMeasurementEligibility({
    observationCount: canonical.snapshots.length,
    distinctPeriods: periods.size,
    experimentCount: canonical.experiments.filter((row) => row.status === "COMPLETED").length,
    channelCount: channels.size,
    hasSpend: serialized.some((row) => row.includes('"spend"')),
    hasOutcome: serialized.some((row) => /conversion|revenue|lead/i.test(row)),
  });

  return (
    <>
      <PageHeader
        title="Performance"
        description="Canonical metrics, evidence, experiment measurement and maturity-gated marketing science."
      />

      <section className="mb-8 space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Measurement layer</h2>
            <p className="mt-1 text-xs text-muted-foreground">LLMs interpret results; deterministic observations and formulas remain the source of truth.</p>
          </div>
          <Badge variant="outline">{canonical.snapshots.length} canonical snapshots</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Card><CardContent className="py-4"><Database className="size-4 text-muted-foreground" /><div className="mt-3 font-mono text-xl">{canonical.snapshots.length}</div><div className="text-xs text-muted-foreground">Observations</div></CardContent></Card>
          <Card><CardContent className="py-4"><Sigma className="size-4 text-muted-foreground" /><div className="mt-3 font-mono text-xl">{periods.size}</div><div className="text-xs text-muted-foreground">Distinct periods</div></CardContent></Card>
          <Card><CardContent className="py-4"><FlaskConical className="size-4 text-muted-foreground" /><div className="mt-3 font-mono text-xl">{canonical.experiments.filter((row) => row.status === "COMPLETED").length}</div><div className="text-xs text-muted-foreground">Completed experiments</div></CardContent></Card>
          <Card><CardContent className="py-4"><BarChart2 className="size-4 text-muted-foreground" /><div className="mt-3 font-mono text-xl">{channels.size}</div><div className="text-xs text-muted-foreground">Measured channels</div></CardContent></Card>
        </div>
        <div className="flex flex-wrap gap-2 rounded-xl border bg-[hsl(var(--surface-1))] p-3">
          {eligibility.map((row) => (
            <div key={row.mode} className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs">
              <Badge variant={row.eligible ? "default" : "secondary"}>{row.eligible ? "ELIGIBLE" : "LOCKED"}</Badge>
              <span className="font-medium">{row.mode}</span>
              {!row.eligible && <span className="text-muted-foreground">{row.reasons.join(" · ")}</span>}
            </div>
          ))}
        </div>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[780px] text-left text-xs">
            <thead className="bg-[hsl(var(--surface-2))] text-muted-foreground">
              <tr><th className="px-3 py-2">Entity</th><th className="px-3 py-2">Period</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Metrics</th><th className="px-3 py-2">Captured</th></tr>
            </thead>
            <tbody>
              {canonical.snapshots.slice(0, 12).map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2"><span className="font-medium">{row.entityType}</span><div className="font-mono text-[10px] text-muted-foreground">{row.entityId}</div></td>
                  <td className="px-3 py-2 font-mono">{row.period}</td>
                  <td className="px-3 py-2">{row.source}</td>
                  <td className="max-w-[360px] px-3 py-2 font-mono text-[10px] text-muted-foreground">{JSON.stringify(row.metrics)}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{row.capturedAt.toLocaleString()}</td>
                </tr>
              ))}
              {canonical.snapshots.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No canonical performance snapshots yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8 space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Facebook Connection</h2>
        <ConnectFacebookForm accounts={accounts} />
      </section>

      <section className="mb-8">
        <PaidPerformanceTable rows={paid} />
      </section>

      {data.rows.length === 0 ? (
        <EmptyState
          icon={BarChart2}
          title="No Organic Posts Yet"
          description="Duyệt bản nháp thành bài đăng để theo dõi Organic. Paid evidence vẫn hiển thị phía trên."
        />
      ) : (
        <div className="space-y-8">
          <section><KpiSummary rows={data.rows} aggregates={data.aggregates} /></section>
          <section className="space-y-3"><h2 className="text-sm font-semibold text-muted-foreground">Metrics Input</h2><MetricInlineTable rows={data.rows} /></section>
          <section className="space-y-3"><h2 className="text-sm font-semibold text-muted-foreground">Charts</h2><PerformanceCharts aggregates={data.aggregates} /></section>
          <section className="grid gap-4 md:grid-cols-2"><PillarPerfTable groups={data.aggregates.byPillar} /><HookPerfTable groups={data.aggregates.byHook} /></section>
        </div>
      )}

      <section className="mt-8">
        <LatestInsightCard insights={data.latestInsights} agentRuntime={agentRuntime} />
      </section>
    </>
  );
}
