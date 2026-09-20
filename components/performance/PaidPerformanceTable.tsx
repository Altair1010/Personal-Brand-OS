import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PaidMetricDTO } from "@/app/(dashboard)/performance/actions";

export function PaidPerformanceTable({ rows }: { rows: PaidMetricDTO[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Meta Ads performance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Chưa có Paid evidence. Nhập số liệu tại tab Chiến dịch.
          </p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{row.campaignName}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(row.capturedAt).toLocaleString("vi-VN")} · {row.source}
                  </p>
                </div>
                <Badge variant={row.state === "EXTERNAL_NOT_CONNECTED" ? "outline" : "secondary"}>
                  {row.state}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:grid-cols-7">
                <Metric label="Spend" value={row.spendMinor} />
                <Metric label="Impressions" value={row.impressions} />
                <Metric label="Reach" value={row.reach} />
                <Metric label="Clicks" value={row.clicks} />
                <Metric label="Link clicks" value={row.linkClicks} />
                <Metric label="Conversions" value={row.conversions} />
                <Metric label="Source" value={row.source} raw />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  raw = false,
}: {
  label: string;
  value: string | number | null;
  raw?: boolean;
}) {
  return (
    <div className="rounded-md bg-muted/40 p-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">
        {value === null ? "—" : raw ? String(value) : Number(value).toLocaleString("vi-VN")}
      </p>
    </div>
  );
}
