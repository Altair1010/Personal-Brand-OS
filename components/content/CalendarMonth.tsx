import { DayCell } from "./DayCell";
import type { CalendarDayDTO } from "@/app/(dashboard)/studio/actions";

interface CalendarMonthProps {
  days: CalendarDayDTO[];
}

// Renders the 30-day plan as a responsive grid (7 columns on wide screens).
export function CalendarMonth({ days }: CalendarMonthProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7">
      {days.map((d) => (
        <DayCell key={d.dayIndex} day={d} />
      ))}
    </div>
  );
}
