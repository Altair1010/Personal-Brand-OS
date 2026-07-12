"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Download,
  Upload,
  CloudUpload,
  CloudDownload,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseClient } from "@/lib/supabase";
import { cloudPush, cloudPull } from "@/lib/cloud-backup/actions";

export function BackupPanel() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // --- cloud sync (EM1b) ---
  const [passphrase, setPassphrase] = useState("");
  const [cloudPending, startCloud] = useTransition();
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [cloudMessage, setCloudMessage] = useState<string | null>(null);

  async function accessToken(): Promise<string | null> {
    try {
      const supabase = await getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      return session?.access_token ?? null;
    } catch {
      return null;
    }
  }

  function onCloudPush() {
    setCloudError(null);
    setCloudMessage(null);
    if (passphrase.length < 8) {
      setCloudError("Passphrase phải từ 8 ký tự trở lên.");
      return;
    }
    startCloud(async () => {
      const token = await accessToken();
      if (!token) {
        setCloudError("Chưa đăng nhập hoặc chưa cấu hình Supabase.");
        return;
      }
      const res = await cloudPush(token, passphrase);
      if (!res.ok) {
        setCloudError(res.error);
        return;
      }
      setCloudMessage("Đã sao lưu lên cloud (không gồm API key/secret).");
    });
  }

  function onCloudPull() {
    setCloudError(null);
    setCloudMessage(null);
    if (passphrase.length < 8) {
      setCloudError("Nhập passphrase đã dùng khi sao lưu.");
      return;
    }
    if (
      !window.confirm(
        "Khôi phục sẽ ghi đè dữ liệu hiện tại bằng snapshot trên cloud. Tiếp tục?",
      )
    ) {
      return;
    }
    startCloud(async () => {
      const token = await accessToken();
      if (!token) {
        setCloudError("Chưa đăng nhập hoặc chưa cấu hình Supabase.");
        return;
      }
      const res = await cloudPull(token, passphrase);
      if (!res.ok) {
        setCloudError(res.error);
        return;
      }
      setCloudMessage(
        "Đã khôi phục từ cloud. Nhập lại API key/secret (không nằm trong backup).",
      );
      router.refresh();
    });
  }

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
    <>
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
            onClick={() => {
              // Route sets Content-Disposition attachment → navigation downloads the .xlsx.
              const a = document.createElement("a");
              a.href = "/api/backup?format=xlsx";
              document.body.appendChild(a);
              a.click();
              a.remove();
            }}
          >
            <FileSpreadsheet className="size-4" />
            Xuất Excel
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

    <Card>
      <CardContent className="space-y-4 py-6">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Sao lưu đám mây (Supabase)
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Đẩy snapshot đã mã hoá lên tài khoản của bạn để khôi phục trên máy khác.
            API key/secret KHÔNG được đưa lên cloud — máy mới nhập lại.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Cần trước một lần: vào Supabase → Storage, tạo bucket riêng tư tên{" "}
            <span className="font-medium text-foreground">backups</span>.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cloud-passphrase">Passphrase mã hoá</Label>
          <Input
            id="cloud-passphrase"
            type="password"
            autoComplete="off"
            placeholder="Tối thiểu 8 ký tự — cần nhập lại khi khôi phục"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Ghi nhớ passphrase này: mất nó thì không giải mã được snapshot.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={cloudPending}
            onClick={onCloudPush}
          >
            {cloudPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CloudUpload className="size-4" />
            )}
            Sao lưu lên cloud
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={cloudPending}
            onClick={onCloudPull}
          >
            {cloudPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CloudDownload className="size-4" />
            )}
            Khôi phục từ cloud
          </Button>
        </div>

        {cloudError && <p className="text-sm text-destructive">{cloudError}</p>}
        {cloudMessage && !cloudError && (
          <p className="text-sm text-muted-foreground">{cloudMessage}</p>
        )}
      </CardContent>
    </Card>
    </>
  );
}
