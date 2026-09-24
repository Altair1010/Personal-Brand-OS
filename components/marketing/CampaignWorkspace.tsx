"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SoftSelect } from "@/components/ui/soft-select";
import { SoftDateTimePicker } from "@/components/ui/soft-datetime-picker";
import { ErrorState } from "@/components/ErrorState";
import {
  createCampaign,
  createMetaAdsCampaign,
  saveMetaAdsMetrics,
  scheduleOrganicPost,
  transitionCampaign,
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
  const searchParams = useSearchParams();
  const facebookAccountId = searchParams.get("fb");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [campaignName, setCampaignName] = useState("Marketing Campaign");
  const [selectedCampaignId, setSelectedCampaignId] = useState(data.campaigns[0]?.id ?? "");
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

  const current = data.campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? data.campaigns[0] ?? null;
  const currentAd = current?.metaAds[0] ?? null;
  const selectedPost = data.approvedPosts.find((post) => post.id === postId) ?? null;

  useEffect(() => {
    if (!selectedPost || scheduledAt) return;
    const source = selectedPost.scheduledAt ?? selectedPost.plannedDate;
    if (!source) return;
    const date = new Date(source);
    if (!selectedPost.scheduledAt) date.setHours(9, 0, 0, 0);
    const pad = (value: number) => String(value).padStart(2, "0");
    setScheduledAt(
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`,
    );
  }, [selectedPost, scheduledAt]);

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

  function onTransitionCampaign(status: string) {
    if (!current) return;
    run(() => transitionCampaign({ campaignId: current.id, status: status as "DRAFT" | "PLANNING" | "READY" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED" }));
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
        facebookAccountId: facebookAccountId ?? undefined,
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
      {error && <ErrorState message={error} />}

      <div className="grid items-stretch gap-5 xl:grid-cols-3">
        <Card className="flex h-full min-h-[430px] flex-col overflow-hidden">

          <CardHeader className="px-6 pb-3 pt-6"><CardTitle className="text-base font-extrabold tracking-tight">1. Campaign</CardTitle></CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3 px-6 pb-6">
            <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
            <Input value={objective} onChange={(e) => setObjective(e.target.value)} />
            <Button className="w-full" onClick={onCreateCampaign} disabled={pending || !data.strategyVersionId}>
              Tạo campaign MIXED
            </Button>
            {data.campaigns.length > 0 && (
              <SoftSelect
                ariaLabel="Chọn chiến dịch"
                value={current?.id ?? ""}
                onChange={setSelectedCampaignId}
                options={data.campaigns.map((campaign) => ({
                  value: campaign.id,
                  label: campaign.name,
                  description: campaign.status,
                }))}
              />
            )}
            {current && (
              <div className="rounded-xl border border-white/20 bg-[var(--neu-inset)] p-4 text-sm [box-shadow:var(--shadow-inset)]">
                <p className="font-medium">{current.name}</p>
                <p className="text-muted-foreground">{current.objective} · {current.channelMode}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant={stateVariant(current.status)}>{current.status}</Badge>
                  {current.imcPlanId && <Badge variant="outline">IMC linked</Badge>}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {current.status === "DRAFT" && <Button size="sm" variant="outline" onClick={() => onTransitionCampaign("PLANNING")} disabled={pending}>Planning</Button>}
                  {current.status === "PLANNING" && <Button size="sm" variant="outline" onClick={() => onTransitionCampaign("READY")} disabled={pending}>Ready</Button>}
                  {current.status === "READY" && <Button size="sm" onClick={() => onTransitionCampaign("ACTIVE")} disabled={pending}>Activate</Button>}
                  {current.status === "ACTIVE" && <>
                    <Button size="sm" variant="outline" onClick={() => onTransitionCampaign("PAUSED")} disabled={pending}>Pause</Button>
                    <Button size="sm" onClick={() => onTransitionCampaign("COMPLETED")} disabled={pending}>Complete</Button>
                  </>}
                  {current.status === "PAUSED" && <>
                    <Button size="sm" onClick={() => onTransitionCampaign("ACTIVE")} disabled={pending}>Resume</Button>
                    <Button size="sm" variant="outline" onClick={() => onTransitionCampaign("COMPLETED")} disabled={pending}>Complete</Button>
                  </>}
                  {["DRAFT","PLANNING","READY","PAUSED","COMPLETED"].includes(current.status) && (
                    <Button size="sm" variant="ghost" onClick={() => onTransitionCampaign("ARCHIVED")} disabled={pending}>Archive</Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex h-full min-h-[430px] flex-col overflow-hidden">
          <CardHeader className="px-6 pb-3 pt-6"><CardTitle className="text-base font-extrabold tracking-tight">2. Organic Delivery</CardTitle></CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3 px-6 pb-6">
            <SoftSelect
              ariaLabel="Chọn bài đã duyệt"
              value={postId}
              onChange={(next) => {
                setPostId(next);
                setScheduledAt("");
              }}
              placeholder="Chọn bài đã duyệt"
              options={[
                { value: "", label: "Chọn bài đã duyệt" },
                ...data.approvedPosts.map((post) => ({ value: post.id, label: post.title })),
              ]}
            />
            <SoftDateTimePicker
              value={scheduledAt}
              onChange={setScheduledAt}
              placeholder="Chọn ngày và giờ đăng"
            />
            <Button className="w-full" variant="outline" onClick={onSchedule} disabled={pending || !current}>
              Lên lịch Organic
            </Button>
            {current?.organicPosts.map((post) => (
              <div key={post.id} className="rounded-xl border border-white/20 bg-[var(--neu-inset)] p-4 text-sm [box-shadow:var(--shadow-inset)]">
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

        <Card className="flex h-full min-h-[430px] flex-col overflow-hidden">
          <CardHeader className="px-6 pb-3 pt-6"><CardTitle className="text-base font-extrabold tracking-tight">3. Meta Ads</CardTitle></CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3 px-6 pb-6">
            <Input value={adName} onChange={(e) => setAdName(e.target.value)} />
            <Input type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} />
            <Input value={audience} onChange={(e) => setAudience(e.target.value)} />
            <Button className="w-full" variant="outline" onClick={onCreateMeta} disabled={pending || !current || !!currentAd}>
              {currentAd ? "Meta Ads seam đã tạo" : "Tạo Meta Ads seam"}
            </Button>
            {currentAd && (
              <div className="rounded-xl border border-white/20 bg-[var(--neu-inset)] p-4 text-sm [box-shadow:var(--shadow-inset)]">
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
        <CardHeader><CardTitle className="text-base">4. Paid Performance Evidence</CardTitle></CardHeader>
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
