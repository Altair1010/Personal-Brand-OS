"use client";

import { useOnboardingStore } from "@/lib/stores/onboarding";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { KpiEditor } from "./KpiEditor";
import { ContentRatioSlider } from "./ContentRatioSlider";

// Step 2 — Goal. name + goalType required; time range + narrative fields optional.

export function GoalForm() {
  const goal = useOnboardingStore((s) => s.goal);
  const patchGoal = useOnboardingStore((s) => s.patchGoal);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="goal-name">Tên mục tiêu *</Label>
          <Input
            id="goal-name"
            value={goal.name}
            onChange={(e) => patchGoal({ name: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="goal-type">Loại mục tiêu *</Label>
          <Input
            id="goal-type"
            value={goal.goalType}
            placeholder="vd: xây dựng thương hiệu / bán hàng"
            onChange={(e) => patchGoal({ goalType: e.target.value })}
          />
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
