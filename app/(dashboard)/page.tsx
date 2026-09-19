import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { RevisionDiff } from "@/components/RevisionDiff";
import { getLatestAdjustment } from "./review/actions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const latest = await getLatestAdjustment();

  return (
    <>
      <PageHeader
        title="Bảng điều khiển"
        description="Theo dõi vòng vận hành marketing từ chiến lược đến bằng chứng và học lại"
      />

      <section className="mb-8 rounded-lg border bg-slate-50 p-4">
        <h2 className="text-sm font-semibold">H1 — Demonstrable marketing loop</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Đi theo một vertical outcome: Brand → Strategy → Content → Approval → Organic/Paid → Performance → Learning.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {[
            ["/onboarding", "1. Brand & Goal"],
            ["/strategy", "2. Strategy"],
            ["/studio", "3. Content"],
            ["/calendar", "4. Delivery"],
            ["/ads", "5. Paid Media"],
            ["/performance", "6. Performance"],
            ["/review", "7. Learning"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="rounded-md border bg-white px-3 py-2 hover:bg-slate-100">
              {label}
            </Link>
          ))}
        </div>
      </section>

      {latest ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Điều chỉnh gần nhất (v{latest.fromVersion} → v{latest.version})
          </h2>
          <RevisionDiff
            currentRatio={latest.currentRatio}
            revisedRatio={latest.revisedRatio}
            reason={latest.reason}
          />
        </section>
      ) : (
        <EmptyState
          icon={LayoutDashboard}
          title="Chưa có dữ liệu"
          description="Hãy bắt đầu bằng cách hoàn thành bước Onboarding để thiết lập thương hiệu của bạn."
        />
      )}
    </>
  );
}
