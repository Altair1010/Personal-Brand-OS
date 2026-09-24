"use client";

import { Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useOnboardingStore } from "@/lib/stores/onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/SearchSelect";
import {
  KPI_LIBRARY,
  kpisForObjective,
} from "@/lib/onboarding/marketing-library";
import type { KpiItem } from "@/lib/validators/goal";

const OTHER = "__other__";
const UNIT_OTHER = "__unit_other__";
const UNITS = ["%", "lượt", "người", "tin nhắn", "đơn hàng", "VNĐ", "ngày"] as const;

function knownKpi(metric: string) {
  return KPI_LIBRARY.find((item) => item.key === metric);
}

function effectiveUnit(row: KpiItem): string {
  return row.unit || knownKpi(row.metric)?.unit || "";
}

export function KpiEditor() {
  const goal = useOnboardingStore((s) => s.goal);
  const kpi = goal.kpi ?? [];
  const setKpi = useOnboardingStore((s) => s.setKpi);
  const [customMetricRows, setCustomMetricRows] = useState<Set<number>>(() => new Set());
  const [customUnitRows, setCustomUnitRows] = useState<Set<number>>(() => new Set());

  const kpiOptions = useMemo<SearchSelectOption[]>(
    () => [
      ...kpisForObjective(goal.goalType).map((item) => ({
        value: item.key,
        label: item.label,
        group: item.objectives.includes(goal.goalType)
          ? "Phù hợp Objective"
          : "KPI phổ biến khác",
        meta: item.unit,
      })),
      {
        value: OTHER,
        label: "KPI tùy chỉnh",
        group: "Tùy chỉnh",
        description: "Nhập KPI chưa có trong thư viện.",
      },
    ],
    [goal.goalType],
  );

  const unitOptions: SearchSelectOption[] = [
    ...UNITS.map((unit) => ({ value: unit, label: unit })),
    { value: UNIT_OTHER, label: "Khác", group: "Tùy chỉnh" },
  ];

  function update(i: number, patch: Partial<KpiItem>) {
    const next = kpi.map((row, idx) => (idx === i ? { ...row, ...patch } : row));
    setKpi(next);
  }

  function onMetricChange(i: number, value: string) {
    if (value === OTHER) {
      setCustomMetricRows((current) => new Set(current).add(i));
      update(i, { metric: "", unit: "" });
      return;
    }
    setCustomMetricRows((current) => {
      const next = new Set(current);
      next.delete(i);
      return next;
    });
    const definition = knownKpi(value);
    update(i, { metric: value, unit: definition?.unit ?? "" });
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div>
        <Label>KPI và chỉ tiêu</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          KPI được ưu tiên theo Objective. Đơn vị lưu riêng với giá trị chỉ tiêu.
        </p>
      </div>

      {kpi.map((row, i) => {
        const definition = knownKpi(row.metric);
        const metricIsCustom = customMetricRows.has(i) || (!definition && Boolean(row.metric));
        const metricSelectValue = definition ? definition.key : metricIsCustom ? OTHER : "";
        const unit = effectiveUnit(row);
        const unitIsCustom =
          customUnitRows.has(i) || (Boolean(unit) && !UNITS.includes(unit as (typeof UNITS)[number]));
        const unitSelectValue = UNITS.includes(unit as (typeof UNITS)[number])
          ? unit
          : unitIsCustom
            ? UNIT_OTHER
            : "";

        return (
          <div key={i} className="grid gap-2 rounded-md bg-muted/20 p-3 md:grid-cols-[minmax(0,1.4fr)_minmax(160px,0.8fr)_150px_36px]">
            <div className="space-y-2">
              <SearchSelect
                value={metricSelectValue}
                options={kpiOptions}
                placeholder="Tìm KPI"
                searchPlaceholder="Tìm KPI..."
                onChange={(value) => onMetricChange(i, value)}
              />
              {metricSelectValue === OTHER && (
                <Input
                  value={row.metric}
                  placeholder="Tên KPI tùy chỉnh"
                  onChange={(e) => update(i, { metric: e.target.value })}
                />
              )}
            </div>

            <div className="relative">
              <Input
                inputMode="decimal"
                value={row.target ?? ""}
                placeholder="Chỉ tiêu"
                className="pr-24"
                onChange={(e) => {
                  const value = e.target.value.replace(",", ".");
                  if (/^-?\d*(?:\.\d*)?[kKmMbB]?$/.test(value)) {
                    update(i, { target: value });
                  }
                }}
              />
              {unit && (
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs italic text-muted-foreground">
                  {unit}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <SearchSelect
                value={unitSelectValue}
                options={unitOptions}
                placeholder="Đơn vị"
                searchPlaceholder="Tìm đơn vị..."
                onChange={(value) => {
                  if (value === UNIT_OTHER) {
                    setCustomUnitRows((current) => new Set(current).add(i));
                    update(i, { unit: "" });
                  } else {
                    setCustomUnitRows((current) => {
                      const next = new Set(current);
                      next.delete(i);
                      return next;
                    });
                    update(i, { unit: value });
                  }
                }}
              />
              {unitSelectValue === UNIT_OTHER && (
                <Input
                  value={row.unit ?? ""}
                  placeholder="Đơn vị tùy chỉnh"
                  onChange={(e) => update(i, { unit: e.target.value })}
                />
              )}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setKpi(kpi.filter((_, idx) => idx !== i))}
              title="Xóa KPI"
            >
              <X className="size-4" />
            </Button>
          </div>
        );
      })}

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
