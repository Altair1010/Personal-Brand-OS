import { BarChart2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { MetricInlineTable } from "@/components/performance/MetricInlineTable";
import { PerformanceCharts } from "@/components/performance/PerformanceCharts";
import { KpiSummary } from "@/components/performance/KpiSummary";
import { PillarPerfTable } from "@/components/performance/PillarPerfTable";
import { HookPerfTable } from "@/components/performance/HookPerfTable";
import { LatestInsightCard } from "@/components/performance/LatestInsightCard";
import { ConnectFacebookForm } from "@/components/performance/ConnectFacebookForm";
import { PaidPerformanceTable } from "@/components/performance/PaidPerformanceTable";
import {
  getAIRuntimeStatus,
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
  const [data, accounts, paid, aiRuntime] = await Promise.all([
    getPerformanceData(fb ?? null),
    listFacebookAccounts(),
    getPaidPerformanceData(),
    getAIRuntimeStatus(),
  ]);

  return (
    <>
      <PageHeader
        title="Hiệu suất"
        description="Theo dõi chỉ số reach, engagement, comments và saves"
      />

      <section className="mb-8 space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Kết nối Facebook
        </h2>
        <ConnectFacebookForm accounts={accounts} />
      </section>

      <section className="mb-8">
        <PaidPerformanceTable rows={paid} />
      </section>

      {data.rows.length === 0 ? (
        <EmptyState
          icon={BarChart2}
          title="Chưa có Organic post"
          description="Duyệt bản nháp thành bài đăng để theo dõi Organic. Paid evidence vẫn hiển thị phía trên."
        />
      ) : (
        <div className="space-y-8">
          <section>
            <KpiSummary rows={data.rows} aggregates={data.aggregates} />
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Nhập số liệu
            </h2>
            <MetricInlineTable rows={data.rows} />
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Biểu đồ
            </h2>
            <PerformanceCharts aggregates={data.aggregates} />
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <PillarPerfTable groups={data.aggregates.byPillar} />
            <HookPerfTable groups={data.aggregates.byHook} />
          </section>

        </div>
      )}

      <section className="mt-8">
        <LatestInsightCard insights={data.latestInsights} aiRuntime={aiRuntime} />
      </section>
    </>
  );
}
