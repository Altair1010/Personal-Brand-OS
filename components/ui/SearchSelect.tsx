"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchSelectOption = {
  value: string;
  label: string;
  group?: string;
  description?: string;
  meta?: string;
};

export function SearchSelect({
  value,
  options,
  placeholder = "Chọn...",
  searchPlaceholder = "Tìm kiếm...",
  onChange,
}: {
  value: string;
  options: SearchSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((item) => item.value === value);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("vi");
    if (!q) return options;
    return options.filter((item) =>
      [item.label, item.group, item.description, item.meta]
        .filter(Boolean)
        .some((text) => text!.toLocaleLowerCase("vi").includes(q)),
    );
  }, [options, query]);

  const groups = useMemo(() => {
    const map = new Map<string, SearchSelectOption[]>();
    for (const item of filtered) {
      const key = item.group ?? "";
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 w-full items-center justify-between rounded-xl border border-input bg-[var(--neu-inset)] px-3 text-left text-sm [box-shadow:var(--shadow-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected?.label ?? (value || placeholder)}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full min-w-[320px] overflow-hidden rounded-xl border border-white/30 bg-popover [box-shadow:var(--shadow-popover)]">
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="size-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-10 w-full bg-transparent text-sm outline-none"
            />
          </div>
          <div className="max-h-80 overflow-y-auto p-1">
            {groups.map(([group, items]) => (
              <div key={group || "all"}>
                {group && (
                  <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {group}
                  </div>
                )}
                {items.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      onChange(item.value);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-[var(--neu-teal-soft)] hover:text-[var(--neu-teal)]"
                  >
                    <Check
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        value === item.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-medium">{item.label}</span>
                        {item.meta && (
                          <span className="shrink-0 text-xs text-muted-foreground">{item.meta}</span>
                        )}
                      </span>
                      {item.description && (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {item.description}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                Không tìm thấy lựa chọn phù hợp.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
