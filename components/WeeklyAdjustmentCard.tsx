"use client";

import { AlertTriangle, Compass, FlaskConical, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  RevisionBundle,
  VersionPerf,
} from "@/app/(dashboard)/review/actions";

interface WeeklyAdjustmentCardProps {
  bundle: RevisionBundle;
  versionPerf?: VersionPerf[];
}

export function WeeklyAdjustmentCard({
  bundle,
  versionPerf,
}: WeeklyAdjustmentCardProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">
          Đề xuất điều chỉnh tuần này
        </CardTitle>
        <Badge className="border-transparent bg-slate-100 text-slate-700">
          từ v{bundle.currentVersion}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* weeklyInsight */}
        <section className="rounded-lg border bg-muted/40 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
            <Lightbulb className="size-4" />
            Insight tuần
          </div>
          <p className="mt-1 text-sm text-foreground">{bundle.weeklyInsight}</p>
        </section>

        {/* adjustmentPlan */}
        <section className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">
            Kế hoạch điều chỉnh
          </h4>
          <ul className="space-y-2">
            {bundle.adjustmentPlan.map((a, i) => (
              <li key={i} className="rounded-lg border p-3">
                <p className="font-medium text-foreground">{a.change}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Lý do: {a.reason}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* nextWeekDirection */}
        <section className="rounded-lg border p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
            <Compass className="size-4" />
            Hướng tuần kế
          </div>
          <p className="mt-1 text-sm text-foreground">
            {bundle.nextWeekDirection}
          </p>
        </section>

        {/* newExperiments */}
        {bundle.newExperiments.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <FlaskConical className="size-4" />
              Thử nghiệm mới
            </div>
            <ul className="list-disc space-y-1 pl-6 text-sm text-foreground">
              {bundle.newExperiments.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </section>
        )}

        {/* warnings (gộp rule + AI) */}
        {bundle.warnings.length > 0 && (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
              <AlertTriangle className="size-4" />
              Cảnh báo
            </div>
            <ul className="mt-1 list-disc space-y-1 pl-6 text-sm text-amber-900">
              {bundle.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </section>
        )}

        {/* versionPerf — so sánh attribution theo version */}
        {versionPerf && versionPerf.length > 0 && (
          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">
              So sánh version (attribution)
            </h4>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Version</th>
                    <th className="px-3 py-2 text-right">Số bài</th>
                    <th className="px-3 py-2 text-right">Reach TB</th>
                    <th className="px-3 py-2 text-right">Tương tác TB</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {versionPerf.map((v) => (
                    <tr key={v.version}>
                      <td className="px-3 py-2 font-medium">v{v.version}</td>
                      <td className="px-3 py-2 text-right">{v.postCount}</td>
                      <td className="px-3 py-2 text-right">{v.avgReach}</td>
                      <td className="px-3 py-2 text-right">
                        {v.avgEngagement}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
