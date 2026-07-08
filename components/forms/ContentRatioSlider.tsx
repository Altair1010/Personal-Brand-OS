"use client";

import { useOnboardingStore } from "@/lib/stores/onboarding";
import { Label } from "@/components/ui/label";
import { OBJECTIVES } from "@/lib/constants";

// Content ratio per objective. Free-form weights here (0–100 each); pillar ratio
// normalize-to-100 is a later concern (M5), so no normalization in the onboarding step.

const OBJECTIVE_LABELS: Record<(typeof OBJECTIVES)[number], string> = {
  seo: "SEO",
  educate: "Giáo dục",
  trust: "Niềm tin",
  conversion: "Chuyển đổi",
  story: "Câu chuyện",
  community: "Cộng đồng",
};

export function ContentRatioSlider() {
  const ratio = useOnboardingStore((s) => s.goal.contentRatio) ?? {};
  const setContentRatio = useOnboardingStore((s) => s.setContentRatio);

  return (
    <div className="space-y-3">
      <Label>Tỉ lệ nội dung theo mục tiêu</Label>
      {OBJECTIVES.map((key) => {
        const value = ratio[key] ?? 0;
        return (
          <div key={key} className="flex items-center gap-3">
            <span className="w-24 text-sm text-muted-foreground">
              {OBJECTIVE_LABELS[key]}
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={value}
              className="flex-1 accent-primary"
              onChange={(e) =>
                setContentRatio({ ...ratio, [key]: Number(e.target.value) })
              }
            />
            <span className="w-10 text-right text-sm tabular-nums">{value}%</span>
          </div>
        );
      })}
    </div>
  );
}
