import { OBJECTIVE_COLORS, type Objective } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { PostChip } from "./PostChip";
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

// One calendar day: dayIndex + objective badge (color from OBJECTIVE_COLORS) + pillar/topic + post chip.
export function DayCell({ day }: DayCellProps) {
  return (
    <div className="flex min-h-[110px] flex-col gap-1.5 rounded-md border bg-card p-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">
          Ngày {day.dayIndex}
        </span>
        {day.plannedObjective && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium",
              objectiveClass(day.plannedObjective),
            )}
          >
            {day.plannedObjective}
          </span>
        )}
      </div>
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
      <div className="mt-auto">
        <PostChip post={day.post} />
      </div>
    </div>
  );
}
