"use client";

import { Card, CardContent } from "@/components/ui/card";
import { OBJECTIVE_COLORS, OBJECTIVES, type Objective } from "@/lib/constants";
import { WeeklyThemeTimeline } from "./WeeklyThemeTimeline";
import type { StrategyDTO } from "@/app/(dashboard)/strategy/actions";

interface StrategyPreviewProps {
  strategy: StrategyDTO;
}

function isObjective(k: string): k is Objective {
  return (OBJECTIVES as readonly string[]).includes(k);
}

function objectiveClass(k: string): string {
  return isObjective(k) ? OBJECTIVE_COLORS[k] : "bg-muted text-muted-foreground";
}

// Content-ratio bar: a single stacked bar across the 6 objectives.
function ContentRatioBar({ ratio }: { ratio: Record<string, number> }) {
  const entries = OBJECTIVES.map((k) => [k, ratio[k] ?? 0] as const).filter(
    ([, v]) => v > 0,
  );
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
  return (
    <div className="space-y-2">
      <div className="flex h-3 w-full overflow-hidden rounded-full border">
        {entries.map(([k, v]) => (
          <div
            key={k}
            className={objectiveClass(k)}
            style={{ width: `${(v / total) * 100}%` }}
            title={`${k}: ${v}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {entries.map(([k, v]) => (
          <span
            key={k}
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${objectiveClass(
              k,
            )}`}
          >
            {k} {v}%
          </span>
        ))}
      </div>
    </div>
  );
}

export function StrategyPreview({ strategy }: StrategyPreviewProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-lg font-semibold">{strategy.name}</h2>
        <span className="text-sm text-muted-foreground">
          phiên bản v{strategy.version}
        </span>
        {strategy.frameworkSlug && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
            {strategy.frameworkSlug}
          </span>
        )}
      </div>

      {strategy.contentRatio && (
        <Card>
          <CardContent className="space-y-2 py-4">
            <h3 className="text-sm font-semibold">Tỷ trọng nội dung tháng</h3>
            <ContentRatioBar ratio={strategy.contentRatio} />
          </CardContent>
        </Card>
      )}

      <WeeklyThemeTimeline weeks={strategy.weeks} />

      {/* 30 daily plans grouped by week */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold">Kế hoạch 30 ngày</h3>
        {strategy.weeks.map((w) => (
          <Card key={w.weekIndex}>
            <CardContent className="py-4">
              <div className="mb-3 flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-semibold">Tuần {w.weekIndex}</span>
                {w.theme && (
                  <span className="text-sm text-muted-foreground">
                    {w.theme}
                  </span>
                )}
              </div>
              {w.notes && (
                <p className="mb-3 text-xs italic text-muted-foreground">
                  {w.notes}
                </p>
              )}
              <div className="space-y-2">
                {w.dailyPlans.map((d) => (
                  <div
                    key={d.dayIndex}
                    className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm"
                  >
                    <span className="w-14 shrink-0 text-xs font-medium text-muted-foreground">
                      Ngày {d.dayIndex}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${objectiveClass(
                        d.plannedObjective,
                      )}`}
                    >
                      {d.plannedObjective}
                    </span>
                    {d.pillarName && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
                        {d.pillarName}
                      </span>
                    )}
                    <span className="flex-1 min-w-[8rem]">
                      {d.suggestedTopic || "—"}
                    </span>
                    {d.suggestedCta && (
                      <span className="text-xs text-muted-foreground">
                        CTA: {d.suggestedCta}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ctaPlan */}
      {strategy.ctaPlan.length > 0 && (
        <Card>
          <CardContent className="space-y-2 py-4">
            <h3 className="text-sm font-semibold">Kế hoạch CTA</h3>
            <ul className="space-y-1 text-sm">
              {strategy.ctaPlan.map((c, i) => (
                <li key={i}>
                  <span className="font-medium">{c.stage}</span>
                  {c.when && (
                    <span className="text-muted-foreground"> ({c.when})</span>
                  )}
                  : {c.cta}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* topicMap */}
      {strategy.topicMap.length > 0 && (
        <Card>
          <CardContent className="space-y-2 py-4">
            <h3 className="text-sm font-semibold">Bản đồ chủ đề</h3>
            <ul className="space-y-1 text-sm">
              {strategy.topicMap.map((tm, i) => (
                <li key={i}>
                  <span className="font-medium">{tm.pillar}:</span>{" "}
                  {tm.topics.join(", ")}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* kpiToTrack + doNotList */}
      <div className="grid gap-4 md:grid-cols-2">
        {strategy.kpiToTrack.length > 0 && (
          <Card>
            <CardContent className="space-y-2 py-4">
              <h3 className="text-sm font-semibold">KPI theo dõi</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {strategy.kpiToTrack.map((k, i) => (
                  <li key={i}>{k}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
        {strategy.doNotList.length > 0 && (
          <Card>
            <CardContent className="space-y-2 py-4">
              <h3 className="text-sm font-semibold">Điều cần tránh</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {strategy.doNotList.map((k, i) => (
                  <li key={i}>{k}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
