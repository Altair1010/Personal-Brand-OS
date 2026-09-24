"use client";

import { useMemo, useState } from "react";
import { Loader2, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { useOnboardingStore } from "@/lib/stores/onboarding";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { OBJECTIVES } from "@/lib/constants";
import { objectiveByKey } from "@/lib/onboarding/marketing-library";
import { invokeAgentAi } from "@/lib/ai/agent-client";

const OBJECTIVE_LABELS: Record<(typeof OBJECTIVES)[number], string> = {
  seo: "SEO / Khám phá",
  educate: "Giáo dục",
  trust: "Niềm tin",
  conversion: "Chuyển đổi",
  story: "Câu chuyện / Trải nghiệm",
  community: "Cộng đồng",
};

type RatioResult = {
  contentRatio: Record<string, number>;
  rationale: string;
  assumptions: string[];
};

type Mode = "manual" | "agent";

export function ContentRatioSlider() {
  const brand = useOnboardingStore((s) => s.brand);
  const goal = useOnboardingStore((s) => s.goal);
  const patchGoal = useOnboardingStore((s) => s.patchGoal);
  const ratio = goal.contentRatio ?? {};
  const [mode, setMode] = useState<Mode>("manual");
  const [loading, setLoading] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [rationale, setRationale] = useState<string | null>(null);
  const [suggestedRatio, setSuggestedRatio] = useState<Record<string, number> | null>(null);

  const total = useMemo(
    () => OBJECTIVES.reduce((sum, key) => sum + Number(ratio[key] ?? 0), 0),
    [ratio],
  );
  const hasRatio = Object.keys(ratio).length > 0;
  const validTotal = !hasRatio || Math.abs(total - 100) < 0.001;

  function update(key: (typeof OBJECTIVES)[number], value: number) {
    patchGoal({ contentRatio: { ...ratio, [key]: value } });
  }

  async function askAgent() {
    setMode("agent");
    setLoading(true);
    setAgentError(null);
    try {
      const objective = objectiveByKey(goal.goalType);
      const result = await invokeAgentAi<RatioResult>("/api/ai/content-ratio", {
        brand: {
          companyName: brand.companyName,
          field: brand.field,
          positioning: brand.aiPositioning,
          threeWords: brand.threeWords,
          usp: brand.usp,
          region: brand.region,
        },
        objective: {
          key: goal.goalType,
          label: objective?.label,
          name: goal.name,
        },
        kpis: goal.kpi ?? [],
        brandStage: "Agent tự suy luận từ Brand DNA và trạng thái dữ liệu hiện có",
      });
      setSuggestedRatio(result.contentRatio);
      patchGoal({ contentRatio: result.contentRatio });
      setRationale(result.rationale);
    } catch (error) {
      setAgentError(
        error instanceof Error ? error.message : "Agent không thể đề xuất tỷ lệ nội dung.",
      );
    } finally {
      setLoading(false);
    }
  }

  function restoreSuggestion() {
    if (suggestedRatio) patchGoal({ contentRatio: suggestedRatio });
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Label>Tỷ lệ nội dung theo mục tiêu</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Tùy chọn. Có thể tự phân bổ hoặc để Agent đề xuất từ Brand DNA, Objective và KPI.
          </p>
        </div>
        <div className="flex rounded-md border bg-muted/30 p-1">
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={mode === "manual" ? "rounded bg-background px-3 py-1.5 text-xs font-medium shadow-sm" : "px-3 py-1.5 text-xs text-muted-foreground"}
          >
            Tự phân bổ
          </button>
          <button
            type="button"
            onClick={() => void askAgent()}
            className={mode === "agent" ? "rounded bg-background px-3 py-1.5 text-xs font-medium shadow-sm" : "px-3 py-1.5 text-xs text-muted-foreground"}
          >
            Agent đề xuất
          </button>
        </div>
      </div>

      {OBJECTIVES.map((key) => {
        const value = ratio[key] ?? 0;
        return (
          <div key={key} className="grid grid-cols-[150px_1fr_58px] items-center gap-3">
            <span className="text-sm text-muted-foreground">{OBJECTIVE_LABELS[key]}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={value}
              className="accent-primary"
              onChange={(event) => update(key, Number(event.target.value))}
            />
            <span className="text-right text-sm tabular-nums">{value}%</span>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <div className={validTotal ? "text-xs text-muted-foreground" : "text-xs font-medium text-destructive"}>
          Tổng: <strong>{total}%</strong>
          {!validTotal && " · cần đúng 100% trước khi lưu"}
        </div>
        <div className="flex gap-2">
          {suggestedRatio && (
            <Button type="button" size="sm" variant="outline" onClick={restoreSuggestion}>
              <RotateCcw className="size-3.5" />
              Khôi phục đề xuất
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void askAgent()}
            disabled={loading}
          >
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            {loading ? "Agent đang phân tích..." : "Đề xuất bằng Agent"}
          </Button>
          {hasRatio && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                patchGoal({ contentRatio: undefined });
                setRationale(null);
              }}
              title="Bỏ tỷ lệ nội dung"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {rationale && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <p className="font-medium">Giải thích của Agent</p>
          <p className="mt-1 text-muted-foreground">{rationale}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Đây là đề xuất khởi tạo. Bạn có thể chỉnh các thanh tỷ trọng và khôi phục đề xuất ban đầu bất kỳ lúc nào trong phiên này.
          </p>
        </div>
      )}
      {agentError && <p className="text-sm text-destructive">{agentError}</p>}
    </div>
  );
}
