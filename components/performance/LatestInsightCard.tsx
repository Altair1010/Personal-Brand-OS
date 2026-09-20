"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { AiLoading } from "@/components/AiLoading";
import {
  runInsight,
  type AIRuntimeStatus,
  type InsightDTO,
} from "@/app/(dashboard)/performance/actions";

interface LatestInsightCardProps {
  insights: InsightDTO[];
  aiRuntime: AIRuntimeStatus;
}

function confidenceBadge(confidence: string) {
  if (confidence === "low") {
    return (
      <Badge className="border-transparent bg-amber-100 text-amber-800">
        Độ tin cậy thấp
      </Badge>
    );
  }
  return (
    <Badge className="border-transparent bg-emerald-100 text-emerald-800">
      Bình thường
    </Badge>
  );
}

export function LatestInsightCard({ insights, aiRuntime }: LatestInsightCardProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  function onGenerate() {
    setError(null);
    startTransition(async () => {
      const res = await runInsight();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setWarnings(res.data.warnings);
      router.refresh();
    });
  }

  const generateButton = (
    <Button
      type="button"
      size="sm"
      disabled={pending || !aiRuntime.ready}
      onClick={onGenerate}
    >
      <Sparkles className="size-4" />
      Phân tích Organic + Paid
    </Button>
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Marketing Intelligence</CardTitle>
        {generateButton}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant={aiRuntime.ready ? "default" : "outline"}>
            {aiRuntime.ready ? "AI READY" : "AI NOT CONFIGURED"}
          </Badge>
          {aiRuntime.ready ? (
            <span className="text-muted-foreground">
              {aiRuntime.provider} · {aiRuntime.model}
            </span>
          ) : (
            <span className="text-muted-foreground">{aiRuntime.reason}</span>
          )}
        </div>
        {error && <ErrorState message={error} />}
        {warnings.length > 0 && (
          <ul className="list-disc space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3 pl-6 text-xs text-amber-800">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}

        {pending ? (
          <AiLoading status="AI đang phân tích số liệu..." />
        ) : insights.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            title="Chưa có insight"
            description="Nhập Organic/Paid evidence rồi chạy intelligence để AI phân tích hiệu suất và đề xuất vòng học tiếp theo."
          />
        ) : (
          <div className="space-y-3">
            {insights.map((ins) => (
              <div key={ins.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase text-muted-foreground">
                    {ins.scope}
                  </span>
                  {confidenceBadge(ins.confidence)}
                </div>
                <p className="mt-2 font-medium text-foreground">
                  {ins.finding}
                </p>
                {ins.evidence && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Bằng chứng: {ins.evidence}
                  </p>
                )}
                {ins.recommendation && (
                  <p className="mt-1 text-sm text-foreground">
                    Đề xuất: {ins.recommendation}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
