"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SoftSelect } from "@/components/ui/soft-select";
import { cn } from "@/lib/utils";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toLocalValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseLocalValue(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export function SoftDateTimePicker({
  value,
  onChange,
  disabled,
  placeholder = "Select date & time",
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = parseLocalValue(value);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => selected ?? new Date());

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (selected) setView(selected);
  }, [value]);

  const days = useMemo(() => {
    const year = view.getFullYear();
    const month = view.getMonth();
    const first = new Date(year, month, 1);
    const start = new Date(year, month, 1 - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [view]);

  function updateDate(date: Date) {
    const base = selected ?? new Date();
    const next = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      base.getHours(),
      base.getMinutes(),
      0,
      0,
    );
    onChange(toLocalValue(next));
  }

  function updateTime(part: "hour" | "minute", raw: string) {
    const base = selected ?? view ?? new Date();
    const next = new Date(base);
    if (part === "hour") next.setHours(Number(raw));
    else next.setMinutes(Number(raw));
    onChange(toLocalValue(next));
  }

  const hour = selected?.getHours() ?? 9;
  const minute = selected?.getMinutes() ?? 0;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 w-full items-center gap-2 rounded-xl border border-input bg-[var(--neu-inset)] px-3 text-left text-sm [box-shadow:var(--shadow-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        <CalendarDays className="size-4 shrink-0 text-[var(--neu-teal)]" />
        <span className={cn("min-w-0 flex-1 truncate", !selected && "text-muted-foreground")}>
          {selected
            ? selected.toLocaleString("vi-VN", {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : placeholder}
        </span>
        <Clock3 className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-[70] mt-2 w-[330px] rounded-2xl border border-white/25 bg-[var(--neu-raised)] p-3 [box-shadow:var(--shadow-popover)]">
          <div className="mb-3 flex items-center justify-between">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="text-sm font-semibold">
              {MONTHS[view.getMonth()]} {view.getFullYear()}
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {["Su","Mo","Tu","We","Th","Fr","Sa"].map((day) => <div key={day}>{day}</div>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map((date) => {
              const inMonth = date.getMonth() === view.getMonth();
              const isSelected =
                selected &&
                date.getFullYear() === selected.getFullYear() &&
                date.getMonth() === selected.getMonth() &&
                date.getDate() === selected.getDate();
              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => updateDate(date)}
                  className={cn(
                    "grid aspect-square place-items-center rounded-lg text-xs transition-colors",
                    inMonth ? "text-foreground" : "text-muted-foreground/45",
                    isSelected
                      ? "bg-[var(--neu-teal)] font-semibold text-primary-foreground [box-shadow:var(--shadow-raised-sm)]"
                      : "hover:bg-[var(--neu-teal-soft)] hover:text-[var(--neu-teal)]",
                  )}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="my-3 h-px bg-[rgba(12,79,84,.12)]" />
          <div className="grid grid-cols-2 gap-2">
            <SoftSelect
              ariaLabel="Hour"
              value={String(hour)}
              options={Array.from({ length: 24 }, (_, index) => ({
                value: String(index),
                label: `${pad(index)} giờ`,
              }))}
              onChange={(next) => updateTime("hour", next)}
            />
            <SoftSelect
              ariaLabel="Minute"
              value={String(minute)}
              options={[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((index) => ({
                value: String(index),
                label: `${pad(index)} phút`,
              }))}
              onChange={(next) => updateTime("minute", next)}
            />
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")}>
              Clear
            </Button>
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
