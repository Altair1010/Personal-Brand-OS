"use client";

import { useMemo, useState } from "react";
import { useOnboardingStore } from "@/lib/stores/onboarding";
import { Label } from "@/components/ui/label";
import { LabelWithHelp } from "@/components/ui/field-help";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/SearchSelect";
import { KpiEditor } from "./KpiEditor";
import { ContentRatioSlider } from "./ContentRatioSlider";
import { HELP_TEXT } from "@/lib/help-text";
import {
  FUNNEL_STAGE_LABELS,
  MARKETING_OBJECTIVES,
  objectiveByKey,
} from "@/lib/onboarding/marketing-library";

const OTHER = "__other__";

export function GoalForm() {
  const goal = useOnboardingStore((s) => s.goal);
  const patchGoal = useOnboardingStore((s) => s.patchGoal);
  const initialKnown = Boolean(objectiveByKey(goal.goalType));
  const [objectiveSelection, setObjectiveSelection] = useState(
    initialKnown ? goal.goalType : goal.goalType ? OTHER : "",
  );

  const objectiveOptions = useMemo<SearchSelectOption[]>(
    () => [
      ...[...MARKETING_OBJECTIVES]
        .sort((a, b) => {
          const stageOrder = ["awareness", "engagement", "consideration", "conversion", "retention", "loyalty"];
          return stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage) || b.popularity - a.popularity;
        })
        .map((item) => ({
          value: item.key,
          label: item.label,
          group: FUNNEL_STAGE_LABELS[item.stage],
          description: item.description,
        })),
      {
        value: OTHER,
        label: "Khác",
        group: "Tùy chỉnh",
        description: "Nhập một Objective riêng nếu thư viện chưa có.",
      },
    ],
    [],
  );

  function onObjectiveChange(value: string) {
    setObjectiveSelection(value);
    if (value === OTHER) {
      if (objectiveByKey(goal.goalType)) patchGoal({ goalType: "" });
      return;
    }
    patchGoal({ goalType: value });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <LabelWithHelp htmlFor="goal-name" help={HELP_TEXT.goalName}>
            Tên mục tiêu *
          </LabelWithHelp>
          <Input
            id="goal-name"
            value={goal.name}
            onChange={(e) => patchGoal({ name: e.target.value })}
          />
        </div>

        <div className="space-y-1">
          <LabelWithHelp help={HELP_TEXT.goalType}>
            Loại mục tiêu (Objective) *
          </LabelWithHelp>
          <SearchSelect
            value={objectiveSelection}
            options={objectiveOptions}
            placeholder="Tìm và chọn Objective"
            searchPlaceholder="Tìm mục tiêu marketing..."
            onChange={onObjectiveChange}
          />
          {objectiveSelection === OTHER && (
            <Input
              value={goal.goalType ?? ""}
              placeholder="Nhập Objective tùy chỉnh"
              onChange={(e) => patchGoal({ goalType: e.target.value })}
            />
          )}
          {objectiveSelection && objectiveSelection !== OTHER && (
            <p className="text-xs text-muted-foreground">
              {objectiveByKey(objectiveSelection)?.description}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="goal-start">Bắt đầu</Label>
          <Input
            id="goal-start"
            type="date"
            value={goal.timeRangeStart ?? ""}
            onChange={(e) => patchGoal({ timeRangeStart: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="goal-end">Kết thúc</Label>
          <Input
            id="goal-end"
            type="date"
            value={goal.timeRangeEnd ?? ""}
            onChange={(e) => patchGoal({ timeRangeEnd: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="goal-audience">Đối tượng mục tiêu</Label>
        <Textarea
          id="goal-audience"
          value={goal.targetAudience ?? ""}
          onChange={(e) => patchGoal({ targetAudience: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="goal-offer">Offer chính</Label>
        <Textarea
          id="goal-offer"
          value={goal.mainOffer ?? ""}
          onChange={(e) => patchGoal({ mainOffer: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="goal-message">Thông điệp chính</Label>
        <Textarea
          id="goal-message"
          value={goal.mainMessage ?? ""}
          onChange={(e) => patchGoal({ mainMessage: e.target.value })}
        />
      </div>

      <KpiEditor />
      <ContentRatioSlider />

      <div className="space-y-1">
        <Label htmlFor="goal-risk">Rủi ro</Label>
        <Textarea
          id="goal-risk"
          value={goal.risk ?? ""}
          onChange={(e) => patchGoal({ risk: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="goal-success">Định nghĩa thành công</Label>
        <Textarea
          id="goal-success"
          value={goal.successDefinition ?? ""}
          onChange={(e) => patchGoal({ successDefinition: e.target.value })}
        />
      </div>
    </div>
  );
}
