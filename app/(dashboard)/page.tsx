import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getJourney() {
  const [dna, state, drafts, approved, campaigns, paidEvidence, insights] =
    await Promise.all([
      db.brandDNA.findUnique({ where: { userId: "local" }, select: { id: true } }),
      db.appState.findUnique({ where: { id: "singleton" } }),
      db.contentDraft.count({ where: { userId: "local" } }),
      db.post.count({ where: { userId: "local", status: { in: ["approved", "posted"] } } }),
      db.marketingCampaign.count(),
      db.metaAdsMetricSnapshot.count(),
      db.performanceInsight.count({ where: { userId: "local" } }),
    ]);
  return { dna: !!dna, strategy: !!state?.activeStrategyId, drafts, approved, campaigns, paidEvidence, insights };
}

export default async function DashboardPage() {
  const s = await getJourney();
  const steps = [
    ["Brand DNA", "/onboarding", s.dna],
    ["Strategy", "/strategy", s.strategy],
    ["Content", "/studio", s.drafts > 0],
    ["Approval", "/studio", s.approved > 0],
    ["Campaign", "/campaigns", s.campaigns > 0],
    ["Paid evidence", "/campaigns", s.paidEvidence > 0],
    ["Performance", "/performance", s.paidEvidence > 0 || s.approved > 0],
    ["Insight", "/performance", s.insights > 0],
  ] as const;

  return (
    <>
      <PageHeader
        title="Piltover H1"
        description="Golden journey: Brand → Strategy → Content → Campaign → Performance → Learning"
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {steps.map(([label, href, done], index) => (
          <Link key={label} href={href}>
            <Card className="h-full transition-colors hover:border-primary">
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">0{index + 1}</span>
                  <Badge variant={done ? "default" : "secondary"}>{done ? "READY" : "NEXT"}</Badge>
                </div>
                <p className="mt-3 font-medium">{label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <div className="mt-6 rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
        <LayoutDashboard className="mr-2 inline size-4" />
        H1 chỉ ghi nhận trạng thái thật. Meta Ads chưa kết nối provider sẽ luôn hiển thị EXTERNAL_NOT_CONNECTED.
      </div>
    </>
  );
}
