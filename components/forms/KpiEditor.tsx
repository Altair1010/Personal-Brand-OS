"use client";

import { Plus, X } from "lucide-react";
import { useOnboardingStore } from "@/lib/stores/onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { KpiItem } from "@/lib/validators/goal";

// Editable list of KPI rows (metric + target). Stored as goal.kpi (Json array).

export function KpiEditor() {
  const kpi = useOnboardingStore((s) => s.goal.kpi) ?? [];
  const setKpi = useOnboardingStore((s) => s.setKpi);

  function update(i: number, patch: Partial<KpiItem>) {
    const next = kpi.map((row, idx) => (idx === i ? { ...row, ...patch } : row));
    setKpi(next);
  }

  return (
    <div className="space-y-2">
      <Label>KPI</Label>
      {kpi.map((row, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={row.metric}
            placeholder="Chỉ số (vd: reach)"
            onChange={(e) => update(i, { metric: e.target.value })}
          />
          <Input
            value={row.target ?? ""}
            placeholder="Mục tiêu (vd: 10k)"
            onChange={(e) => update(i, { target: e.target.value })}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setKpi(kpi.filter((_, idx) => idx !== i))}
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setKpi([...kpi, { metric: "" }])}
      >
        <Plus className="size-4" />
        Thêm KPI
      </Button>
    </div>
  );
}
