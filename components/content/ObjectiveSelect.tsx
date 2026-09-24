"use client";

import { Label } from "@/components/ui/label";
import { SoftSelect } from "@/components/ui/soft-select";
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
      <SoftSelect
        value={value ?? ""}
        disabled={disabled}
        onChange={onChange}
        placeholder="— chọn —"
        options={[
          { value: "", label: "— chọn —" },
          ...OBJECTIVES.map((o) => ({ value: o, label: o.toUpperCase() })),
        ]}
      />
    </div>
  );
}
