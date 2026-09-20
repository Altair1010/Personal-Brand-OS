"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createCampaign,
  createMetaAdsCampaign,
  saveMetaAdsMetrics,
  scheduleOrganicPost,
  type CampaignWorkspaceData,
} from "@/app/(dashboard)/campaigns/actions";

function n(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function stateVariant(state: string) {
  return state === "PUBLISHED" || state === "SYNCED" || state === "COMPLETED"
    ? "default"
    : state === "EXTERNAL_NOT_CONNECTED"
      ? "outline"
      : "secondary";
}
export function CampaignWorkspace({ data }: { data: CampaignWorkspaceData }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [campaignName, setCampaignName] = useState("H1 Marketing Campaign");
  const [objective, setObjective] = useState("conversion");
  const [postId, setPostId] = useState(data.approvedPosts[0]?.id ?? "");
  const [scheduledAt, setScheduledAt] = useState("");
  const [adName, setAdName] = useState("Meta conversion campaign");
  const [budget, setBudget] = useState("500000");
  const [audience, setAudience] = useState("Vietnam, 25-44, core audience");
  const [metrics, setMetrics] = useState({
    spend: "0",
    impressions: "0",
    reach: "0",
    clicks: "0",
    linkClicks: "0",
    conversions: "0",
  });

  const current = data.campaigns[0] ?? null;
  const currentAd = current?.metaAds[0] ?? null;

  function run(task: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await task();
      if (!result.ok) {
        setError(result.error ?? "Thao tác thất bại.");
        return;
      }
      router.refresh();
    });
  }
  function onCreateCampaign() {
    run(() =>
      createCampaign({
        name: campaignName,
        objective,
        channelMode: "MIXED",
        strategyVersionId: data.strategyVersionId ?? undefined,
      }),
    );
  }

  function onSchedule() {
    if (!current || !postId || !scheduledAt) {
      setError("Chọn chiến dịch, bài viết và thời gian lên lịch.");
      return;
    }
    run(() =>
      scheduleOrganicPost({
        campaignId: current.id,
        postId,
        scheduledAt: new Date(scheduledAt).toISOString(),
      }),
    );
  }

  function onCreateMeta() {
    if (!current) {
      setError("Tạo chiến dịch marketing trước.");
      return;
    }
    run(() =>
      createMetaAdsCampaign({
        marketingCampaignId: current.id,
        creativePostId: postId || undefined,
        name: adName,
        objective,
        budgetMinor: n(budget),
        currency: "VND",
        audience,
      }),
    );
  }
  function onSaveMetrics() {
    if (!currentAd) {
      setError("Chưa có Meta Ads campaign.");
      return;
    }
    run(() =>
      saveMetaAdsMetrics({
        metaAdsCampaignId: currentAd.id,
        spendMinor: n(metrics.spend),
        impressions: n(metrics.impressions),
        reach: n(metrics.reach),
        clicks: n(metrics.clicks),
        linkClicks: n(metrics.linkClicks),
        conversions: n(metrics.conversions),
      }),
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">1. Chiến dịch</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
            <Input value={objective} onChange={(e) => setObjective(e.target.value)} />
            <Button onClick={onCreateCampaign} disabled={pending || !!current}>
              {current ? "Đã có campaign H1" : "Tạo campaign MIXED"}
            </Button>
            {current && (
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">{current.name}</p>
                <p className="text-muted-foreground">{current.objective} · {current.channelMode}</p>
                <Badge className="mt-2" variant={stateVariant(current.status)}>{current.status}</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">2. Organic delivery</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={postId}
              onChange={(e) => setPostId(e.target.value)}
            >
              <option value="">Chọn bài đã duyệt</option>
              {data.approvedPosts.map((post) => (
                <option key={post.id} value={post.id}>{post.title}</option>
              ))}
            </select>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
            <Button variant="outline" onClick={onSchedule} disabled={pending || !current}>
              Lên lịch Organic
            </Button>
            {current?.organicPosts.map((post) => (
              <div key={post.id} className="rounded-md border p-3 text-sm">
                <p className="font-medium">{post.title}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant={stateVariant(post.deliveryState ?? "")}>
                    {post.deliveryState ?? "NO_DELIVERY"}
                  </Badge>
                  {post.scheduledAt && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(post.scheduledAt).toLocaleString("vi-VN")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">3. Meta Ads seam</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input value={adName} onChange={(e) => setAdName(e.target.value)} />
            <Input type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} />
            <Input value={audience} onChange={(e) => setAudience(e.target.value)} />
            <Button variant="outline" onClick={onCreateMeta} disabled={pending || !current || !!currentAd}>
              {currentAd ? "Meta Ads seam đã tạo" : "Tạo Meta Ads seam"}
            </Button>
            {currentAd && (
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">{currentAd.name}</p>
                <p className="text-muted-foreground">
                  Budget: {(currentAd.budgetMinor ?? 0).toLocaleString("vi-VN")} {currentAd.currency}
                </p>
                <Badge className="mt-2" variant={stateVariant(currentAd.state)}>
                  {currentAd.state}
                </Badge>
                {currentAd.state === "EXTERNAL_NOT_CONNECTED" && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Chưa kết nối Meta API. H1 không coi đây là campaign đang chạy thật.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">4. Paid performance evidence</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {([
              ["spend", "Spend"],
              ["impressions", "Impressions"],
              ["reach", "Reach"],
              ["clicks", "Clicks"],
              ["linkClicks", "Link clicks"],
              ["conversions", "Conversions"],
            ] as const).map(([key, label]) => (
              <label key={key} className="space-y-1">
                <span className="text-xs text-muted-foreground">{label}</span>
                <Input
                  type="number"
                  min={0}
                  value={metrics[key]}
                  onChange={(e) => setMetrics((m) => ({ ...m, [key]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={onSaveMetrics} disabled={pending || !currentAd}>
              Lưu Paid evidence
            </Button>
            <span className="text-xs text-muted-foreground">
              Nguồn H1: nhập tay, có provenance; không giả lập Meta API.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
