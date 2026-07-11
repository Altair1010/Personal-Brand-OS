"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, BarChart2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import {
  saveMetric,
  fetchMetricFromUrl,
  type PostRow,
} from "@/app/(dashboard)/performance/actions";

interface MetricInlineTableProps {
  rows: PostRow[];
}

// Nhãn FB ngắn cạnh mỗi metric.
const METRIC_LABELS = {
  reach: "Số người tiếp cận",
  engagement: "Tương tác",
  comments: "Bình luận",
  saves: "Lưu",
} as const;

type RowDraft = {
  reach: string;
  engagement: string;
  comments: string;
  saves: string;
  inboxNote: string;
  conversionNote: string;
};

function toDraft(m: PostRow["metrics"]): RowDraft {
  return {
    reach: m?.reach != null ? String(m.reach) : "",
    engagement: m?.engagement != null ? String(m.engagement) : "",
    comments: m?.comments != null ? String(m.comments) : "",
    saves: m?.saves != null ? String(m.saves) : "",
    inboxNote: m?.inboxNote ?? "",
    conversionNote: m?.conversionNote ?? "",
  };
}

function num(v: string): number {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function MetricRow({ row }: { row: PostRow }) {
  const router = useRouter();
  const [draft, setDraft] = useState<RowDraft>(() => toDraft(row.metrics));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const [postUrl, setPostUrl] = useState("");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetching, startFetch] = useTransition();

  function set<K extends keyof RowDraft>(key: K, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  }

  function onFetchFromFacebook() {
    setFetchError(null);
    startFetch(async () => {
      const res = await fetchMetricFromUrl({ postId: row.postId, postUrl });
      if (!res.ok) {
        setFetchError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function onSave() {
    setError(null);
    startTransition(async () => {
      const res = await saveMetric({
        postId: row.postId,
        reach: num(draft.reach),
        engagement: num(draft.engagement),
        comments: num(draft.comments),
        saves: num(draft.saves),
        inboxNote: draft.inboxNote || undefined,
        conversionNote: draft.conversionNote || undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{row.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {[row.pillarName, row.format, row.hookStyle]
              .filter(Boolean)
              .join(" · ") || "—"}{" "}
            · {row.daysSincePost} ngày kể từ đăng
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={onSave}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : saved ? (
            <Check className="size-4" />
          ) : null}
          Lưu
        </Button>
      </div>

      {row.facebookAccountId && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              Dán link bài viết Facebook
            </span>
            <Input
              value={postUrl}
              onChange={(e) => setPostUrl(e.target.value)}
              placeholder="https://facebook.com/…/posts/…"
            />
          </label>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={fetching}
            onClick={onFetchFromFacebook}
          >
            {fetching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Tự điền từ Facebook
          </Button>
        </div>
      )}
      {fetchError && (
        <p className="mt-2 text-sm text-destructive">{fetchError}</p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          ["reach", "engagement", "comments", "saves"] as const
        ).map((key) => (
          <label key={key} className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              {METRIC_LABELS[key]}
            </span>
            <Input
              type="number"
              min={0}
              value={draft[key]}
              onChange={(e) => set(key, e.target.value)}
            />
          </label>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Ghi chú inbox</span>
          <Input
            value={draft.inboxNote}
            onChange={(e) => set("inboxNote", e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            Ghi chú chuyển đổi
          </span>
          <Input
            value={draft.conversionNote}
            onChange={(e) => set("conversionNote", e.target.value)}
          />
        </label>
      </div>

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function MetricInlineTable({ rows }: MetricInlineTableProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={BarChart2}
        title="Chưa có bài đăng"
        description="Duyệt bản nháp thành bài đăng để nhập số liệu."
      />
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <MetricRow key={row.postId} row={row} />
      ))}
    </div>
  );
}
