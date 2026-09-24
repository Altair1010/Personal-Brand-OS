"use client";

import { Label } from "@/components/ui/label";
import { SoftSelect } from "@/components/ui/soft-select";
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
      <div className="md:w-80">
        <SoftSelect
          value={value ?? NONE}
          disabled={disabled}
          ariaLabel="Framework"
          placeholder="Select framework"
          onChange={(next) => onChange(next === NONE ? undefined : next)}
          options={[
            { value: NONE, label: "No framework" },
            ...frameworks.map((framework) => ({
              value: framework.slug,
              label: framework.name,
              description: framework.summary ?? undefined,
            })),
          ]}
        />
      </div>
      {selected?.summary && (
        <p className="text-xs text-muted-foreground">{selected.summary}</p>
      )}
    </div>
  );
}
