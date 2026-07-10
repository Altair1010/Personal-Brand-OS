"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Sparkles, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AiLoading } from "@/components/AiLoading";
import { ErrorState } from "@/components/ErrorState";

interface HookItem {
  text: string;
  style: string;
}

interface HookGeneratorPanelProps {
  topic: string;
  objectiveKey: string | null;
  persona: Record<string, unknown>;
  onInsert: (text: string) => void;
}

function isHookItem(v: unknown): v is HookItem {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as HookItem).text === "string" &&
    typeof (v as HookItem).style === "string"
  );
}

export function HookGeneratorPanel({
  topic,
  objectiveKey,
  persona,
  onInsert,
}: HookGeneratorPanelProps) {
  const [hooks, setHooks] = useState<HookItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai/hook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          objectiveKey,
          persona,
          count: 5,
        }),
      });
      const json: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof json === "object" && json !== null && "error" in json
            ? String((json as { error: unknown }).error)
            : "Sinh hook thất bại";
        throw new Error(msg);
      }
      const data =
        typeof json === "object" && json !== null && "data" in json
          ? (json as { data: unknown }).data
          : null;
      const list =
        typeof data === "object" && data !== null && "hooks" in data
          ? (data as { hooks: unknown }).hooks
          : null;
      return Array.isArray(list) ? list.filter(isHookItem) : [];
    },
    onSuccess: (items) => {
      setError(null);
      setHooks(items);
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Sinh hook thất bại."),
  });

  const disabled = !topic || !objectiveKey || mutation.isPending;

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Gợi ý Hook</h3>
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
              <Sparkles className="size-4" />
            )}
            Sinh hook
          </Button>
        </div>
        {!objectiveKey && (
          <p className="text-xs text-muted-foreground">
            Chọn objective và nhập chủ đề trước khi sinh hook.
          </p>
        )}
        {mutation.isPending && <AiLoading status="Đang sinh hook…" />}
        {error && <ErrorState message={error} />}
        {!mutation.isPending && hooks.length > 0 && (
          <ul className="space-y-2">
            {hooks.map((h, i) => (
              <li
                key={i}
                className="flex items-start justify-between gap-2 rounded-md border p-2"
              >
                <div className="min-w-0">
                  <p className="text-sm">{h.text}</p>
                  <Badge variant="outline" className="mt-1">
                    {h.style}
                  </Badge>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onInsert(h.text)}
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
