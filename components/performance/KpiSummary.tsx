import { Card, CardContent } from "@/components/ui/card";
import type { AggregateResult } from "@/lib/performance-engine/aggregate";
import type { PostRow } from "@/app/(dashboard)/performance/actions";

interface KpiSummaryProps {
  rows: PostRow[];
  aggregates: AggregateResult;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
}

// Top-of-page KPI row (hand-built cards — no extra dep; recharts still handles the charts).
export function KpiSummary({ rows, aggregates }: KpiSummaryProps) {
  const withMetrics = rows.filter((r) => r.metrics !== null);
  const avgReach = avg(
    withMetrics.map((r) => r.metrics?.reach ?? 0),
  );
  const avgEngagement = avg(
    withMetrics.map((r) => r.metrics?.engagement ?? 0),
  );
  const topPillar = [...aggregates.byPillar].sort(
    (a, b) => b.avgEngagement - a.avgEngagement,
  )[0];

  const items: { label: string; value: string; sub?: string }[] = [
    { label: "Tổng bài đăng", value: String(rows.length) },
    {
      label: "Reach trung bình",
      value: avgReach.toLocaleString("vi-VN"),
      sub: `${withMetrics.length} bài có số liệu`,
    },
    {
      label: "Tương tác trung bình",
      value: avgEngagement.toLocaleString("vi-VN"),
    },
    {
      label: "Pillar mạnh nhất",
      value: topPillar?.label ?? "—",
      sub: topPillar ? `tương tác TB ${topPillar.avgEngagement}` : undefined,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it) => (
        <Card key={it.label}>
          <CardContent className="space-y-1 py-4">
            <div className="text-xs font-medium text-muted-foreground">
              {it.label}
            </div>
            <div className="truncate text-2xl font-semibold text-foreground">
              {it.value}
            </div>
            {it.sub && (
              <div className="text-xs text-muted-foreground">{it.sub}</div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
