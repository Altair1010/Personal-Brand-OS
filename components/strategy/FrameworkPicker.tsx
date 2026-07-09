"use client";

import { Label } from "@/components/ui/label";
import type { FrameworkDTO } from "@/app/(dashboard)/strategy/actions";

interface FrameworkPickerProps {
  frameworks: FrameworkDTO[];
  value: string | undefined; // slug, or undefined = no framework
  onChange: (slug: string | undefined) => void;
  disabled?: boolean;
}

const NONE = "__none__";

// Simple native select: 4 seeded frameworks + an explicit "no framework" option.
export function FrameworkPicker({
  frameworks,
  value,
  onChange,
  disabled,
}: FrameworkPickerProps) {
  const selected = frameworks.find((f) => f.slug === value);

  return (
    <div className="space-y-1.5">
      <Label htmlFor="framework-picker">Framework (tuỳ chọn)</Label>
      <select
        id="framework-picker"
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:w-80"
        value={value ?? NONE}
        disabled={disabled}
        onChange={(e) =>
          onChange(e.target.value === NONE ? undefined : e.target.value)
        }
      >
        <option value={NONE}>Không dùng framework</option>
        {frameworks.map((f) => (
          <option key={f.slug} value={f.slug}>
            {f.name}
          </option>
        ))}
      </select>
      {selected?.summary && (
        <p className="text-xs text-muted-foreground">{selected.summary}</p>
      )}
    </div>
  );
}
