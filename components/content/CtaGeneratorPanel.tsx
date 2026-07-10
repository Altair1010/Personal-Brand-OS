"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Megaphone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AiLoading } from "@/components/AiLoading";
import { ErrorState } from "@/components/ErrorState";
import { CTA_INTENSITY } from "@/lib/constants";

interface CtaItem {
  text: string;
  intensity: string;
}

interface CtaGeneratorPanelProps {
  objectiveKey: string | null;
  goal: Record<string, unknown>;
  offer: string | null;
  intensity: string | null;
  onInsert: (text: string) => void;
}

function isCtaItem(v: unknown): v is CtaItem {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as CtaItem).text === "string" &&
    typeof (v as CtaItem).intensity === "string"
  );
}

export function CtaGeneratorPanel({
  objectiveKey,
  goal,
  offer,
  intensity,
  onInsert,
}: CtaGeneratorPanelProps) {
  const [ctas, setCtas] = useState<CtaItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // intensity chỉ nhận từ CTA_INTENSITY; fallback "soft".
  const safeIntensity =
    intensity && (CTA_INTENSITY as readonly string[]).includes(intensity)
      ? intensity
      : "soft";

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai/cta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectiveKey,
          goal,
          offer: offer ?? undefined,
          intensity: safeIntensity,
        }),
      });
      const json: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof json === "object" && json !== null && "error" in json
            ? String((json as { error: unknown }).error)
            : "Sinh CTA thất bại";
        throw new Error(msg);
      }
      const data =
        typeof json === "object" && json !== null && "data" in json
          ? (json as { data: unknown }).data
          : null;
      const list =
        typeof data === "object" && data !== null && "ctas" in data
          ? (data as { ctas: unknown }).ctas
          : null;
      return Array.isArray(list) ? list.filter(isCtaItem) : [];
    },
    onSuccess: (items) => {
      setError(null);
      setCtas(items);
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Sinh CTA thất bại."),
  });

  const disabled = !objectiveKey || mutation.isPending;

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Gợi ý CTA</h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Megaphone className="size-4" />
            )}
            Sinh CTA
          </Button>
        </div>
        {!objectiveKey && (
          <p className="text-xs text-muted-foreground">
            Chọn objective trước khi sinh CTA.
          </p>
        )}
        {mutation.isPending && <AiLoading status="Đang sinh CTA…" />}
        {error && <ErrorState message={error} />}
        {!mutation.isPending && ctas.length > 0 && (
          <ul className="space-y-2">
            {ctas.map((c, i) => (
              <li
                key={i}
                className="flex items-start justify-between gap-2 rounded-md border p-2"
              >
                <div className="min-w-0">
                  <p className="text-sm">{c.text}</p>
                  <Badge variant="outline" className="mt-1">
                    {c.intensity}
                  </Badge>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onInsert(c.text)}
                >
                  <Plus className="size-4" />
                  Chèn
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
