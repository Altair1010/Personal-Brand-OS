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
        description="Tổng quan về hoạt động thương hiệu cá nhân của bạn"
      />

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
