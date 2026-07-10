"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function BackupPanel() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onExport() {
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) {
        setError("Xuất backup thất bại.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const date = new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = url;
      a.download = `personal-brand-backup-${date}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage("Đã xuất backup.");
    } catch {
      setError("Không kết nối được tới máy chủ.");
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setMessage(null);
    const file = e.target.files?.[0];
    // Reset so choosing the same file again re-triggers change.
    e.target.value = "";
    if (!file) return;

    if (
      !window.confirm(
        "Nhập backup sẽ ghi đè dữ liệu hiện tại bằng nội dung file. Tiếp tục?",
      )
    ) {
      return;
    }

    startTransition(async () => {
      try {
        const text = await file.text();
        const res = await fetch("/api/backup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: text,
        });
        const data = (await res.json().catch(() => null)) as
          | { ok?: true; error?: string }
          | null;
        if (!res.ok) {
          setError(data?.error ?? "Nhập backup thất bại.");
          return;
        }
        setMessage("Đã nhập backup thành công.");
        router.refresh();
      } catch {
        setError("Không đọc được file hoặc không kết nối được máy chủ.");
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-6">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Sao lưu & khôi phục
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Xuất toàn bộ dữ liệu ra một file JSON, hoặc nhập lại để khôi phục.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={onExport}>
            <Download className="size-4" />
            Xuất backup
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Nhập backup
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={onPickFile}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {message && !error && (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}
      </CardContent>
    </Card>
  );
}
