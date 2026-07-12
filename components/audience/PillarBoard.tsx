"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LabelWithHelp } from "@/components/ui/field-help";
import { HELP_TEXT } from "@/lib/help-text";
import { OBJECTIVES } from "@/lib/constants";
import { EmptyState } from "@/components/EmptyState";
import { Target } from "lucide-react";
import { RatioBar } from "./RatioBar";
import { emptyPillar } from "./helpers";
import type { ObjectiveMix, PillarDraft } from "./types";

// Pillar editor list. ratioPercent is editable; RatioBar shows the normalized-to-100 split.
// objectiveMix keys are the fixed 6 OBJECTIVES — the user can only tune values, not add keys.

const MIN = 3;
const MAX = 5;

interface PillarBoardProps {
  pillars: PillarDraft[];
  onChange: (pillars: PillarDraft[]) => void;
}

export function PillarBoard({ pillars, onChange }: PillarBoardProps) {
  function patchAt(idx: number, patch: Partial<PillarDraft>) {
    onChange(pillars.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }
  function patchMix(idx: number, key: keyof ObjectiveMix, value: number) {
    const p = pillars[idx];
    patchAt(idx, { objectiveMix: { ...p.objectiveMix, [key]: value } });
  }
  function addPillar() {
    if (pillars.length >= MAX) return;
    onChange([...pillars, emptyPillar()]);
  }
  function removeAt(idx: number) {
    if (pillars.length <= 1) return;
    onChange(pillars.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-4">
      {pillars.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Chưa có trụ cột"
          description="Bấm “Sinh trụ cột (AI)” hoặc thêm thủ công (3–5 trụ cột)."
        />
      ) : (
        <>
          <RatioBar
            segments={pillars.map((p) => ({
              label: p.name || "(chưa đặt tên)",
              weight: p.ratioPercent,
            }))}
          />
          <div className="space-y-3">
            {pillars.map((p, idx) => (
              <div
                key={p._key}
                className="rounded-lg border bg-card p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    Trụ cột #{idx + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pillars.length <= 1}
                    onClick={() => removeAt(idx)}
                  >
                    <Trash2 className="size-4" />
                    Xoá
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <LabelWithHelp
                      htmlFor={`${p._key}-name`}
                      help={HELP_TEXT.pillarName}
                      className="mb-1"
                    >
                      Tên trụ cột
                    </LabelWithHelp>
                    <Input
                      id={`${p._key}-name`}
                      value={p.name}
                      onChange={(e) => patchAt(idx, { name: e.target.value })}
                      placeholder="vd: Tâm lý giao dịch"
                    />
                  </div>
                  <div>
                    <LabelWithHelp
                      htmlFor={`${p._key}-ratio`}
                      help={HELP_TEXT.pillarRatio}
                      className="mb-1"
                    >
                      Tỷ trọng (ratioPercent)
                    </LabelWithHelp>
                    <Input
                      id={`${p._key}-ratio`}
                      type="number"
                      min={0}
                      value={p.ratioPercent}
                      onChange={(e) =>
                        patchAt(idx, {
                          ratioPercent: Number(e.target.value) || 0,
                        })
                      }
                      placeholder="vd: 30"
                    />
                  </div>
                </div>
                <div>
                  <LabelWithHelp
                    htmlFor={`${p._key}-desc`}
                    help={HELP_TEXT.pillarDescription}
                    className="mb-1"
                  >
                    Mô tả
                  </LabelWithHelp>
                  <Textarea
                    id={`${p._key}-desc`}
                    value={p.description}
                    onChange={(e) =>
                      patchAt(idx, { description: e.target.value })
                    }
                    placeholder="vd: Bài về kiểm soát cảm xúc, kỷ luật vào/thoát lệnh."
                    className="min-h-[60px]"
                  />
                </div>
                <div>
                  <LabelWithHelp
                    help={HELP_TEXT.pillarObjectiveMix}
                    className="mb-1"
                  >
                    Objective mix (6 mục tiêu cố định)
                  </LabelWithHelp>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {OBJECTIVES.map((obj) => (
                      <div key={obj} className="flex items-center gap-2">
                        <span className="w-24 shrink-0 text-xs text-muted-foreground">
                          {obj}
                        </span>
                        <Input
                          type="number"
                          min={0}
                          value={p.objectiveMix[obj]}
                          onChange={(e) =>
                            patchMix(idx, obj, Number(e.target.value) || 0)
                          }
                          className="h-8"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pillars.length >= MAX}
          onClick={addPillar}
        >
          <Plus className="size-4" />
          Thêm trụ cột
        </Button>
        <span>
          {pillars.length}/{MAX} trụ cột (khuyến nghị {MIN}–{MAX})
        </span>
      </div>
    </div>
  );
}
