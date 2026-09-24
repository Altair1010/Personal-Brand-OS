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
      <h3 className="text-lg font-bold tracking-tight text-foreground">5-Week Framework</h3>
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
              className="flex min-h-[190px] flex-col rounded-2xl border border-white/20 bg-card p-4 text-card-foreground"
            >
              <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--neu-teal)]">
                Week {w.weekIndex}
              </div>
              <div className="mt-2 text-base font-bold leading-5 text-foreground">{w.theme ?? "—"}</div>
              {w.focusPillarName && (
                <div className="mt-2 text-justify text-xs leading-5 text-muted-foreground">
                  Trọng tâm: {w.focusPillarName}
                </div>
              )}
              {mix.length > 0 && (
                <div className="mt-auto grid grid-cols-2 gap-1.5 pt-4">
                  {mix.map(([k, v]) => (
                    <span
                      key={k}
                      className={`inline-flex items-center justify-center rounded-lg px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.04em] ${
                        isObjective(k)
                          ? OBJECTIVE_COLORS[k]
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {k.toUpperCase()} {v}%
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
