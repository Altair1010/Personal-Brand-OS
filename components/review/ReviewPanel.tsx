"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ErrorState";
import { AiLoading } from "@/components/AiLoading";
import { WeeklyAdjustmentCard } from "@/components/WeeklyAdjustmentCard";
import { RevisionDiff } from "@/components/RevisionDiff";
import {
  generateRevision,
  applyRevisionAction,
  type RevisionBundle,
  type VersionPerf,
} from "@/app/(dashboard)/review/actions";

interface ReviewPanelProps {
  versionPerf: VersionPerf[];
  weekNumber: number;
}

export function ReviewPanel({ versionPerf, weekNumber }: ReviewPanelProps) {
  const router = useRouter();
  const [bundle, setBundle] = useState<RevisionBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<{ version: number } | null>(null);
  const [genPending, startGen] = useTransition();
  const [applyPending, startApply] = useTransition();

  function onGenerate() {
    setError(null);
    setApplied(null);
    startGen(async () => {
      const res = await generateRevision();
      if (!res.ok) {
        setError(res.error);
        setBundle(null);
        return;
      }
      setBundle(res.data);
    });
  }

  function onApply() {
    if (!bundle) return;
    setError(null);
    startApply(async () => {
      const res = await applyRevisionAction({
        revisedContentRatio: bundle.revisedContentRatio,
        reasonForNewVersion: bundle.reasonForNewVersion,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setApplied({ version: res.data.version });
      setBundle(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Tuần {weekNumber} — sinh đề xuất điều chỉnh dựa trên insight & attribution.
        </p>
        <Button type="button" disabled={genPending} onClick={onGenerate}>
          <Sparkles className="size-4" />
          Sinh đề xuất điều chỉnh
        </Button>
      </div>

      {error && <ErrorState message={error} />}

      {applied && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <Check className="size-4" />
          Đã tạo version v{applied.version}.
        </div>
      )}

      {genPending ? (
        <AiLoading status="AI đang đề xuất điều chỉnh chiến lược..." />
      ) : (
        bundle && (
          <div className="space-y-6">
            <WeeklyAdjustmentCard bundle={bundle} versionPerf={versionPerf} />
            <RevisionDiff
              currentRatio={bundle.currentContentRatio}
              revisedRatio={bundle.revisedContentRatio}
              reason={bundle.reasonForNewVersion}
            />
            <div className="flex justify-end">
              <Button
                type="button"
                disabled={applyPending}
                onClick={onApply}
              >
                {applyPending ? "Đang áp dụng..." : "Áp dụng — tạo version mới"}
              </Button>
            </div>
          </div>
        )
      )}
    </div>
  );
}
