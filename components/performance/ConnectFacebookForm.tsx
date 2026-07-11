"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Facebook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  connectFacebookAccount,
  type FacebookAccountDTO,
} from "@/app/(dashboard)/performance/actions";

interface ConnectFacebookFormProps {
  accounts: FacebookAccountDTO[];
}

export function ConnectFacebookForm({ accounts }: ConnectFacebookFormProps) {
  const router = useRouter();
  const [pageId, setPageId] = useState("");
  const [pageAccessToken, setPageAccessToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [connectedName, setConnectedName] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onConnect() {
    setError(null);
    setConnectedName(null);
    startTransition(async () => {
      const res = await connectFacebookAccount({ pageId, pageAccessToken });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setConnectedName(res.data.pageName);
      setPageAccessToken("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      {accounts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {accounts.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-foreground"
            >
              <Facebook className="size-3" />
              {a.pageName}
            </span>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Page ID</span>
          <Input
            value={pageId}
            onChange={(e) => setPageId(e.target.value)}
            placeholder="Ví dụ: 1234567890"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            Page Access Token
          </span>
          <Input
            type="password"
            value={pageAccessToken}
            onChange={(e) => setPageAccessToken(e.target.value)}
            placeholder="Dán token trang"
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={onConnect}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : connectedName ? (
            <Check className="size-4" />
          ) : null}
          Kết nối
        </Button>
        {connectedName && (
          <p className="text-sm text-emerald-600">
            Đã kết nối trang “{connectedName}”.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
