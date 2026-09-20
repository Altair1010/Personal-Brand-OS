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
  syncLatestMarketingIntelligence,
  type AgentRuntimeStatus,
  type InsightDTO,
} from "@/app/(dashboard)/performance/actions";

interface LatestInsightCardProps {
  insights: InsightDTO[];
  agentRuntime: AgentRuntimeStatus;
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

export function LatestInsightCard({ insights, agentRuntime }: LatestInsightCardProps) {
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

  function onSync() {
    setError(null);
    startTransition(async () => {
      const res = await syncLatestMarketingIntelligence();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setWarnings([`Đã đồng bộ ${res.data.count} insight từ agent run ${res.data.runId}.`]);
      router.refresh();
    });
  }

  const generateButton = (
    <Button
      type="button"
      size="sm"
      disabled={pending}
      onClick={onGenerate}
    >
      <Sparkles className="size-4" />
      Giao cho Agent
    </Button>
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Marketing Intelligence</CardTitle>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onSync}>
            Đồng bộ kết quả Agent
          </Button>
          {generateButton}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant={agentRuntime.ready ? "default" : "outline"}>
            {agentRuntime.ready ? "AGENT READY" : "AGENT CONNECTOR OFFLINE"}
          </Badge>
          {agentRuntime.ready ? (
            <span className="text-muted-foreground">
              {agentRuntime.route} · {agentRuntime.controller}
              {agentRuntime.route === "OPENCLAW"
                ? ` · Termius ${agentRuntime.termius ? "ON" : "OFF"} · 9router ${agentRuntime.router9 ? "ON" : "OFF"}`
                : ""}
            </span>
          ) : (
            <span className="text-muted-foreground">{agentRuntime.reason}</span>
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
          <AiLoading status="Đang giao việc / đồng bộ Agent..." />
        ) : insights.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            title="Chưa có insight"
            description="Nhập Organic/Paid evidence, giao việc qua Agent Control Plane, rồi đồng bộ kết quả agent để tạo insight."
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
