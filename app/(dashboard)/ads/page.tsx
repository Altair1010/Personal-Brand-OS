import { Megaphone } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  createAdCampaign,
  generateAdInsight,
  getAdsData,
  saveAdMetrics,
  setAdCampaignStatus,
} from "./actions";

export const dynamic = "force-dynamic";

const inputClass =
  "w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30";

function audienceText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const summary = (value as { summary?: unknown }).summary;
  return typeof summary === "string" ? summary : "";
}

export default async function AdsPage() {
  const data = await getAdsData();

  return (
    <>
      <PageHeader
        title="Paid Media / Ads"
        description="Lập campaign nội bộ, gắn creative đã duyệt, ghi bằng chứng hiệu suất và đưa insight trở lại vòng chiến lược."
      />

      <div className="mb-6 rounded-lg border bg-slate-50 p-4 text-sm">
        <div className="font-medium">{data.scope.brandName}</div>
        <div className="mt-1 text-muted-foreground">
          H1 uses INTERNAL_DEMO delivery only. No external ad spend or live campaign mutation occurs here.
        </div>
      </div>

      <section className="mb-8 space-y-4">
        <div>
          <h2 className="text-base font-semibold">Tạo paid campaign</h2>
          <p className="text-sm text-muted-foreground">
            Campaign dùng chung Brand, Strategy và creative đã qua approval.
          </p>
        </div>

        {data.approvedDrafts.length === 0 ? (
          <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
            Chưa có creative đã duyệt. Hoàn tất một draft trong Studio trước khi tạo Ads campaign.
          </div>
        ) : (
          <form action={createAdCampaign} className="grid gap-3 rounded-lg border p-4 md:grid-cols-2">
            <input className={inputClass} name="name" placeholder="Tên campaign" required />
            <input className={inputClass} name="objective" placeholder="Mục tiêu: leads / sales / awareness" required />
            <input className={inputClass} name="audience" placeholder="Audience / targeting summary" required />
            <input className={inputClass} name="budgetAmount" type="number" min="0" step="1000" placeholder="Ngân sách dự kiến (VND)" required />

            <input className={inputClass} name="bidIntent" placeholder="Bid intent (optional)" />
            <select className={inputClass} name="creativeDraftId" required defaultValue="">
              <option value="" disabled>Chọn creative đã duyệt</option>
              {data.approvedDrafts.map((draft) => (
                <option key={draft.id} value={draft.id}>{draft.title}</option>
              ))}
            </select>
            <button
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground md:col-span-2"
              type="submit"
            >
              Tạo campaign nội bộ
            </button>
          </form>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4" />
          <h2 className="text-base font-semibold">Campaign engine</h2>
        </div>

        {data.campaigns.length === 0 ? (
          <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
            Chưa có paid campaign.
          </div>
        ) : (
          <div className="space-y-4">

            {data.campaigns.map((campaign) => {
              const latest = new Map<string, number>();
              for (const metric of campaign.metrics) {
                if (!latest.has(metric.metricKey)) latest.set(metric.metricKey, metric.numericValue);
              }
              return (
                <article key={campaign.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{campaign.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {campaign.objective} · {audienceText(campaign.audience)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {campaign.deliveryMode} · {campaign.status} · Budget {campaign.budgetAmount ?? 0} {campaign.budgetCurrency}
                      </p>
                    </div>
                    <form action={setAdCampaignStatus} className="flex gap-2">
                      <input type="hidden" name="campaignId" value={campaign.id} />
                      <select className={inputClass} name="status" defaultValue={campaign.status}>
                        {["DRAFT", "READY", "RUNNING", "PAUSED", "COMPLETED"].map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                      <button className="rounded-md border px-3 py-2 text-sm" type="submit">Cập nhật</button>
                    </form>
                  </div>

                  <form action={saveAdMetrics} className="mt-4 grid gap-2 md:grid-cols-5">
                    <input type="hidden" name="campaignId" value={campaign.id} />
                    <input className={inputClass} name="spend" type="number" min="0" step="1" placeholder={`Spend (${latest.get("spend") ?? 0})`} />
                    <input className={inputClass} name="impressions" type="number" min="0" step="1" placeholder={`Impressions (${latest.get("impressions") ?? 0})`} />
                    <input className={inputClass} name="clicks" type="number" min="0" step="1" placeholder={`Clicks (${latest.get("clicks") ?? 0})`} />
                    <input className={inputClass} name="conversions" type="number" min="0" step="1" placeholder={`Conversions (${latest.get("conversions") ?? 0})`} />
                    <input className={inputClass} name="revenue" type="number" min="0" step="1" placeholder={`Revenue (${latest.get("revenue") ?? 0})`} />
                    <button className="rounded-md border px-3 py-2 text-sm md:col-span-4" type="submit">
                      Ghi performance evidence
                    </button>
                    <button
                      className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                      formAction={generateAdInsight}
                      type="submit"
                    >
                      Tạo insight
                    </button>
                  </form>

                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-base font-semibold">Paid-media learning</h2>
        {data.insights.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Chưa có Ads insight. Ghi metrics rồi tạo insight để đưa bằng chứng vào vòng Review.
          </p>
        ) : (
          data.insights.map((insight) => (
            <div key={insight.id} className="rounded-lg border p-4">
              <div className="text-sm font-medium">{insight.finding}</div>
              <div className="mt-1 text-sm text-muted-foreground">{insight.recommendation}</div>
              <div className="mt-2 text-xs text-muted-foreground">
                Confidence: {insight.confidence}
              </div>
            </div>
          ))
        )}
      </section>
    </>
  );
}
