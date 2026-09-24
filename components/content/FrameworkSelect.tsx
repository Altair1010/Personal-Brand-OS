"use client";

import { Label } from "@/components/ui/label";
import { SoftSelect } from "@/components/ui/soft-select";
import type { FrameworkDTO } from "@/app/(dashboard)/studio/actions";

interface FrameworkSelectProps {
  frameworks: FrameworkDTO[];
  value: string | null; // framework slug
  disabled?: boolean;
  onChange: (value: string) => void;
}

// Framework list comes from the seeded Framework table (aida/pas/bab/storybrand) + "none".
export function FrameworkSelect({
  frameworks,
  value,
  disabled,
  onChange,
}: FrameworkSelectProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="sel-framework">Framework</Label>
      <SoftSelect
        value={value ?? ""}
        disabled={disabled}
        onChange={onChange}
        placeholder="Không dùng framework"
        options={[
          { value: "", label: "Không dùng framework" },
          ...frameworks.map((framework) => ({ value: framework.slug, label: framework.name })),
        ]}
      />
    </div>
  );
}
