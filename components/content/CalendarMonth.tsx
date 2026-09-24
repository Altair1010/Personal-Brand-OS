"use client";

import { useState } from "react";
import { DayCell } from "./DayCell";
import { FacebookPostComposer } from "./FacebookPostComposer";
import type { CalendarDayDTO } from "@/app/(dashboard)/studio/actions";

interface CalendarMonthProps { days: CalendarDayDTO[]; }

export function CalendarMonth({ days }: CalendarMonthProps) {
  const [selected, setSelected] = useState<CalendarDayDTO | null>(null);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7">
        {days.map((day) => <DayCell key={day.dailyPlanId} day={day} onOpen={() => setSelected(day)} />)}
      </div>
      {selected && <FacebookPostComposer day={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
