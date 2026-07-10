"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  saveModelConfig,
  deleteModelConfig,
  type AiModelConfigDTO,
} from "@/app/(dashboard)/settings/actions";

interface AiModelConfigFormProps {
  configs: AiModelConfigDTO[];
  active: { provider: string; model: string } | null;
}

const PROVIDERS = ["anthropic", "openai"] as const;

function toNum(v: string): number | undefined {
  if (v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function AiModelConfigForm({ configs, active }: AiModelConfigFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [provider, setProvider] = useState<(typeof PROVIDERS)[number]>(
    "anthropic",
  );
  const [model, setModel] = useState("");
  const [label, setLabel] = useState("");
  const [temperature, setTemperature] = useState("");
  const [maxTokens, setMaxTokens] = useState("");
  const [isDefault, setIsDefault] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function onSave() {
    setError(null);
    setSaved(false);
    if (model.trim() === "") {
      setError("Nhập tên model.");
      return;
    }
    startTransition(async () => {
      const res = await saveModelConfig({
        provider,
        model: model.trim(),
        label: label.trim() || undefined,
        temperature: toNum(temperature),
        maxTokens:
          toNum(maxTokens) != null ? Math.trunc(toNum(maxTokens)!) : undefined,
        isDefault,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(true);
      setModel("");
      setLabel("");
      setTemperature("");
      setMaxTokens("");
      router.refresh();
    });
  }

  function onDelete(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await deleteModelConfig(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="space-y-6 py-6">
        <div>
          <h2 className="text-base font-semibold text-foreground">Model AI</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Model đang dùng:{" "}
            {active ? (
              <span className="font-medium text-foreground">
                {active.provider}/{active.model}
              </span>
            ) : (
              <span className="font-medium text-destructive">chưa chọn</span>
            )}
          </p>
        </div>

        {/* Existing configs */}
        {configs.length > 0 && (
          <div className="space-y-2">
            {configs.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-4 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                    {c.provider}/{c.model || "—"}
                    {c.isDefault && <Badge variant="default">mặc định</Badge>}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[
                      c.label,
                      c.temperature != null ? `temp ${c.temperature}` : null,
                      c.maxTokens != null ? `max ${c.maxTokens}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => onDelete(c.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add form */}
        <div className="space-y-4 border-t pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="provider">Nhà cung cấp</Label>
              <select
                id="provider"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={provider}
                onChange={(e) =>
                  setProvider(e.target.value as (typeof PROVIDERS)[number])
                }
              >
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="model">Tên model</Label>
              <Input
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="ví dụ: claude-... hoặc gpt-..."
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="label">Nhãn (tùy chọn)</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="temperature">Temperature (tùy chọn)</Label>
              <Input
                id="temperature"
                type="number"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="maxTokens">Max tokens (tùy chọn)</Label>
              <Input
                id="maxTokens"
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(e.target.value)}
              />
            </div>

            <label className="flex items-center gap-2 self-end pb-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="size-4"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
              />
              Đặt làm mặc định
            </label>
          </div>

          <div className="flex items-center gap-3">
            <Button type="button" disabled={pending} onClick={onSave}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : saved ? (
                <Check className="size-4" />
              ) : null}
              Lưu cấu hình
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {saved && !error && (
              <p className="text-sm text-muted-foreground">Đã lưu.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
