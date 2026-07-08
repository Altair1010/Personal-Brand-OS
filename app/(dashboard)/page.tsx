import { LayoutDashboard } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Bảng điều khiển"
        description="Tổng quan về hoạt động thương hiệu cá nhân của bạn"
      />
      <EmptyState
        icon={LayoutDashboard}
        title="Chưa có dữ liệu"
        description="Hãy bắt đầu bằng cách hoàn thành bước Onboarding để thiết lập thương hiệu của bạn."
      />
    </>
  );
}
