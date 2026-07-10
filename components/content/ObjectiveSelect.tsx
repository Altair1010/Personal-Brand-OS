"use client";

import { Label } from "@/components/ui/label";
import { OBJECTIVES } from "@/lib/constants";

interface ObjectiveSelectProps {
  value: string | null;
  disabled?: boolean;
  onChange: (value: string) => void;
}

// Enum values come ONLY from OBJECTIVES (lib/constants).
export function ObjectiveSelect({
  value,
  disabled,
  onChange,
}: ObjectiveSelectProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="sel-objective">Objective</Label>
      <select
        id="sel-objective"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">— chọn —</option>
        {OBJECTIVES.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
