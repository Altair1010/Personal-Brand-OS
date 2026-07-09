"use client";

import { Badge } from "@/components/ui/badge";
import { OBJECTIVE_COLORS, OBJECTIVES, type Objective } from "@/lib/constants";
import type { StrategyWeekDTO } from "@/app/(dashboard)/strategy/actions";

interface WeeklyThemeTimelineProps {
  weeks: StrategyWeekDTO[];
}

function isObjective(k: string): k is Objective {
  return (OBJECTIVES as readonly string[]).includes(k);
}

// 5-week timeline: each week shows its theme, focus pillar, and objectivesMix as colored badges.
export function WeeklyThemeTimeline({ weeks }: WeeklyThemeTimelineProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Khung 5 tuần</h3>
      <ol className="grid gap-3 md:grid-cols-5">
        {weeks.map((w) => {
          const mix = w.objectivesMix
            ? Object.entries(w.objectivesMix)
                .filter(([, v]) => v > 0)
                .sort((a, b) => b[1] - a[1])
            : [];
          return (
            <li
              key={w.weekIndex}
              className="rounded-lg border bg-card p-3 text-card-foreground"
            >
              <div className="text-xs font-medium text-muted-foreground">
                Tuần {w.weekIndex}
              </div>
              <div className="mt-1 text-sm font-semibold">
                {w.theme ?? "—"}
              </div>
              {w.focusPillarName && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Trọng tâm: {w.focusPillarName}
                </div>
              )}
              {mix.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {mix.map(([k, v]) => (
                    <span
                      key={k}
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        isObjective(k)
                          ? OBJECTIVE_COLORS[k]
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {k} {v}%
                    </span>
                  ))}
                </div>
              )}
              {mix.length === 0 && (
                <Badge variant="outline" className="mt-2">
                  chưa có mix
                </Badge>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
