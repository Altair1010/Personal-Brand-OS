"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetDatabase } from "@/app/(dashboard)/settings/actions";

const CONFIRM = "RESET";

export function DangerZone() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Layer 1: exact-match text input gates the button.
  const canReset = text === CONFIRM;

  function onReset() {
    setError(null);
    setMessage(null);
    // Layer 2: explicit confirm dialog before the destructive call.
    if (
      !window.confirm(
        "Bạn chắc chắn? Toàn bộ dữ liệu sẽ bị xóa và dựng lại seed gốc.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await resetDatabase(CONFIRM);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setText("");
      setMessage("Đã reset dữ liệu về seed gốc.");
      router.refresh();
    });
  }

  return (
    <Card className="border-destructive/40">
      <CardContent className="space-y-4 py-6">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-5 flex-shrink-0 text-destructive" />
          <div>
            <h2 className="text-base font-semibold text-destructive">
              Vùng nguy hiểm
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Reset sẽ XÓA toàn bộ dữ liệu và dựng lại seed gốc. Không thể hoàn
              tác.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-confirm">
            Gõ <span className="font-mono font-semibold">{CONFIRM}</span> để bật
            nút
          </Label>
          <Input
            id="reset-confirm"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={CONFIRM}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="destructive"
            disabled={!canReset || pending}
            onClick={onReset}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Reset dữ liệu
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {message && !error && (
            <p className="text-sm text-muted-foreground">{message}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
