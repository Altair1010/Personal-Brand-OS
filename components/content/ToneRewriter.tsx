"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AiLoading } from "@/components/AiLoading";
import { ErrorState } from "@/components/ErrorState";

interface ToneRewriterProps {
  currentBody: string;
  onRewritten: (rewritten: string) => void;
}

// Rewrites the current body to a target tone (giữ ý chính) via /api/ai/tone.
export function ToneRewriter({ currentBody, onRewritten }: ToneRewriterProps) {
  const [targetTone, setTargetTone] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai/tone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: currentBody, targetTone }),
      });
      const json: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof json === "object" && json !== null && "error" in json
            ? String((json as { error: unknown }).error)
            : "Đổi tone thất bại";
        throw new Error(msg);
      }
      const data =
        typeof json === "object" && json !== null && "data" in json
          ? (json as { data: unknown }).data
          : null;
      const rewritten =
        typeof data === "object" && data !== null && "rewritten" in data
          ? String((data as { rewritten: unknown }).rewritten)
          : "";
      const changes =
        typeof data === "object" && data !== null && "changesSummary" in data
          ? String((data as { changesSummary: unknown }).changesSummary)
          : "";
      return { rewritten, changes };
    },
    onSuccess: ({ rewritten, changes }) => {
      setError(null);
      if (rewritten) {
        onRewritten(rewritten);
        setSummary(changes || "Đã viết lại theo giọng điệu mới.");
      }
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Đổi tone thất bại."),
  });

  const disabled = !currentBody || !targetTone || mutation.isPending;

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <h3 className="text-sm font-semibold">Đổi giọng điệu (giữ ý)</h3>
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="tone-target">Giọng điệu mục tiêu</Label>
            <Input
              id="tone-target"
              value={targetTone}
              placeholder="ví dụ: thẳng thắn, dứt khoát"
              onChange={(e) => setTargetTone(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Wand2 className="size-4" />
            )}
            Viết lại
          </Button>
        </div>
        {mutation.isPending && <AiLoading status="Đang viết lại nội dung…" />}
        {error && <ErrorState message={error} />}
        {summary && !mutation.isPending && (
          <p className="text-xs text-muted-foreground">{summary}</p>
        )}
      </CardContent>
    </Card>
  );
}
