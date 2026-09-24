"use client";

import { CalendarDays, Image as ImageIcon, Link2, Pencil } from "lucide-react";
import { OBJECTIVE_COLORS, type Objective } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { CalendarDayDTO } from "@/app/(dashboard)/studio/actions";

function objectiveClass(objective: string | null): string {
  return objective && objective in OBJECTIVE_COLORS
    ? OBJECTIVE_COLORS[objective as Objective]
    : "bg-muted text-muted-foreground";
}

export function DayCell({ day, onOpen }: { day: CalendarDayDTO; onOpen: () => void }) {
  const date = day.date ? new Date(day.date) : null;
  const scheduledAt = day.post?.scheduledAt ? new Date(day.post.scheduledAt) : null;
  const assetCount = day.assets.length;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-h-[170px] flex-col gap-2 rounded-xl border border-white/20 bg-card p-3 text-left transition hover:-translate-y-0.5 hover:border-[var(--neu-teal)]/35 hover:[box-shadow:var(--shadow-raised-sm)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-foreground">
            {date ? date.toLocaleDateString("vi-VN", { day: "2-digit", month: "short" }) : `Day ${day.dayIndex}`}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {date ? date.toLocaleDateString("vi-VN", { weekday: "short", year: "numeric" }) : `Strategy day ${day.dayIndex}`}
          </div>
        </div>
        <Pencil className="size-3.5 text-muted-foreground transition group-hover:text-[var(--neu-teal)]" />
      </div>

      {day.plannedObjective && (
        <span className={cn("w-fit rounded-full px-2 py-0.5 text-[9px] font-bold uppercase", objectiveClass(day.plannedObjective))}>
          {day.plannedObjective}
        </span>
      )}

      <div className="min-h-0 flex-1">
        <p className="line-clamp-2 text-xs font-semibold leading-5 text-foreground">{day.suggestedTopic ?? "Untitled post"}</p>
        <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
          {day.content ?? day.suggestedCta ?? "Click để soạn nội dung Facebook."}
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-white/15 pt-2 text-[10px] text-muted-foreground">
        <span className="inline-flex min-w-0 items-center gap-1">
          <CalendarDays className="size-3 shrink-0" />
          <span className="truncate">
            {scheduledAt
              ? `${scheduledAt.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })} · ${scheduledAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`
              : day.post?.deliveryState ?? day.draftStatus ?? "planned"}
          </span>
        </span>
        <span className="flex items-center gap-2">
          {assetCount > 0 && <span className="inline-flex items-center gap-1"><ImageIcon className="size-3"/>{assetCount}</span>}
          {day.assets.some((a) => a.sourceType === "GOOGLE_DRIVE") && <Link2 className="size-3"/>}
        </span>
      </div>
    </button>
  );
}
