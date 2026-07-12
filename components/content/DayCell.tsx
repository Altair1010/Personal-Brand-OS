"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { OBJECTIVE_COLORS, OBJECTIVES, type Objective } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { PostChip } from "./PostChip";
import { updateDailyPlan } from "@/app/(dashboard)/strategy/actions";
import type { CalendarDayDTO } from "@/app/(dashboard)/studio/actions";

interface DayCellProps {
  day: CalendarDayDTO;
}

function objectiveClass(objective: string | null): string {
  if (objective && objective in OBJECTIVE_COLORS) {
    return OBJECTIVE_COLORS[objective as Objective];
  }
  return "bg-muted text-muted-foreground";
}

const selectClass =
  "h-8 w-full rounded-md border border-input bg-transparent px-1 text-[11px] shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

// One calendar day: read view (dayIndex + objective badge + pillar/topic + post chip) with an
// inline edit toggle to update objective/topic/cta in place (EM2c T9). Pillar edit lives on the
// Strategy screen; here we keep the cell compact.
export function DayCell({ day }: DayCellProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [objective, setObjective] = useState(
    day.plannedObjective || OBJECTIVES[0],
  );
  const [topic, setTopic] = useState(day.suggestedTopic ?? "");
  const [cta, setCta] = useState(day.suggestedCta ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    start(async () => {
      const res = await updateDailyPlan(day.dailyPlanId, {
        plannedObjective: objective as Objective,
        suggestedTopic: topic,
        suggestedCta: cta,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-[110px] flex-col gap-1.5 rounded-md border bg-card p-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">
          Ngày {day.dayIndex}
        </span>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground"
          aria-label={editing ? "Đóng" : "Sửa"}
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? (
            <X className="size-3.5" />
          ) : (
            <Pencil className="size-3.5" />
          )}
        </button>
      </div>

      {editing ? (
        <div className="flex flex-col gap-1.5">
          <select
            className={selectClass}
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
          >
            {OBJECTIVES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <Input
            className="h-8 text-[11px]"
            value={topic}
            placeholder="Chủ đề"
            onChange={(e) => setTopic(e.target.value)}
          />
          <Input
            className="h-8 text-[11px]"
            value={cta}
            placeholder="CTA"
            onChange={(e) => setCta(e.target.value)}
          />
          {error && <p className="text-[10px] text-destructive">{error}</p>}
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="inline-flex items-center justify-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Check className="size-3" />
            )}
            Lưu
          </button>
        </div>
      ) : (
        <>
          {day.plannedObjective && (
            <span
              className={cn(
                "w-fit rounded-full px-2 py-0.5 text-[10px] font-medium",
                objectiveClass(day.plannedObjective),
              )}
            >
              {day.plannedObjective}
            </span>
          )}
          {day.pillarName && (
            <p className="truncate text-[11px] font-medium text-foreground">
              {day.pillarName}
            </p>
          )}
          {day.suggestedTopic && (
            <p className="line-clamp-2 text-[11px] text-muted-foreground">
              {day.suggestedTopic}
            </p>
          )}
        </>
      )}

      <div className="mt-auto">
        <PostChip post={day.post} />
      </div>
    </div>
  );
}
