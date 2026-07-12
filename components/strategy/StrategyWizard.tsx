"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Loader2, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AiLoading } from "@/components/AiLoading";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { FrameworkPicker } from "./FrameworkPicker";
import { StrategyPreview } from "./StrategyPreview";
import {
  generateStrategy,
  exportStrategyMd,
  getStrategyData,
  type BrandContextDTO,
  type GoalContextDTO,
  type PersonaContextDTO,
  type PillarContextDTO,
  type FrameworkDTO,
  type StrategyDTO,
} from "@/app/(dashboard)/strategy/actions";

interface StrategyWizardProps {
  brand: BrandContextDTO;
  goal: GoalContextDTO | null;
  personas: PersonaContextDTO[];
  pillars: PillarContextDTO[];
  frameworks: FrameworkDTO[];
  initialStrategy: StrategyDTO | null;
}

// Progress messages cycle while the multi-step generation (tier-1 + 5 weeks) runs.
const GEN_STATUS = "Đang dựng khung tháng rồi lập kế hoạch từng tuần…";

export function StrategyWizard({
  brand,
  goal,
  personas,
  pillars,
  frameworks,
  initialStrategy,
}: StrategyWizardProps) {
  const router = useRouter();
  const [strategy, setStrategy] = useState<StrategyDTO | null>(initialStrategy);
  const [frameworkSlug, setFrameworkSlug] = useState<string | undefined>(
    initialStrategy?.frameworkSlug ?? undefined,
  );
  const [genError, setGenError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // The strategy page loads its own data server-side; after generating we refresh so the
  // freshly-persisted version (with pillar-name resolution) is reflected on next render.
  const genMutation = useMutation({
    mutationFn: async () => {
      const res = await generateStrategy({ frameworkSlug });
      if (!res.ok) return res;
      // Re-read the persisted version so the preview reflects pillar-name resolution.
      const data = await getStrategyData();
      return { ok: true as const, data: { strategy: data.strategy } };
    },
    onSuccess: (res) => {
      if (!res.ok) {
        setGenError(res.error);
        return;
      }
      setGenError(null);
      setStrategy(res.data.strategy);
      router.refresh();
    },
    onError: () => setGenError("Không kết nối được tới máy chủ."),
  });

  const exportMutation = useMutation({
    mutationFn: (strategyVersionId: string) =>
      exportStrategyMd({ strategyVersionId }),
    onSuccess: (res) => {
      if (!res.ok) {
        setExportError(res.error);
        return;
      }
      setExportError(null);
      // Client-side download of the returned markdown.
      const blob = new Blob([res.data.markdown], {
        type: "text/markdown;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.data.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    onError: () => setExportError("Xuất Markdown thất bại."),
  });

  if (!goal) {
    return (
      <EmptyState
        icon={Target}
        title="Chưa có mục tiêu"
        description="Không tìm thấy mục tiêu đang hoạt động. Hãy hoàn thành Onboarding trước."
      />
    );
  }

  const generating = genMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Controls: framework picker + generate button */}
      <Card>
        <CardContent className="space-y-4 py-4">
          <FrameworkPicker
            frameworks={frameworks}
            value={frameworkSlug}
            onChange={setFrameworkSlug}
            disabled={generating}
          />
          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={() => genMutation.mutate()}
              disabled={generating}
            >
              {generating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {strategy
                ? "Sinh lại chiến lược 30 ngày"
                : "Sinh chiến lược 30 ngày"}
            </Button>
            {strategy && (
              <Button
                type="button"
                variant="outline"
                onClick={() => exportMutation.mutate(strategy.versionId)}
                disabled={exportMutation.isPending || generating}
              >
                {exportMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                Xuất Markdown
              </Button>
            )}
            {strategy && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  // Route sets Content-Disposition attachment → navigation downloads the .xlsx.
                  const a = document.createElement("a");
                  a.href = `/api/export/xlsx?versionId=${strategy.versionId}`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                }}
                disabled={generating}
              >
                <FileSpreadsheet className="size-4" />
                Xuất Excel
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Nguồn: {personas.length} persona · {pillars.length} trụ cột ·{" "}
            {brand.positioning ? "có định vị" : "chưa có định vị"}
          </p>
        </CardContent>
      </Card>

      {genError && (
        <ErrorState message={genError} onRetry={() => genMutation.mutate()} />
      )}
      {exportError && <ErrorState message={exportError} />}

      {generating ? (
        <Card className="border-dashed">
          <CardContent className="py-4">
            <AiLoading status={GEN_STATUS} />
          </CardContent>
        </Card>
      ) : strategy ? (
        <StrategyPreview strategy={strategy} pillars={pillars} />
      ) : (
        <EmptyState
          icon={Sparkles}
          title="Chưa có chiến lược"
          description="Chọn framework (tuỳ chọn) rồi bấm “Sinh chiến lược 30 ngày” để dựng khung tháng và kế hoạch từng tuần."
        />
      )}
    </div>
  );
}
