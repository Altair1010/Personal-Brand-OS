"use client";

import { Label } from "@/components/ui/label";
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
      <select
        id="sel-framework"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">Không dùng framework</option>
        {frameworks.map((f) => (
          <option key={f.slug} value={f.slug}>
            {f.name}
          </option>
        ))}
      </select>
    </div>
  );
}
