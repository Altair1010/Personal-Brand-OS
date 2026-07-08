import { Map } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export default function StrategyPage() {
  return (
    <>
      <PageHeader
        title="Chiến lược nội dung"
        description="Lập kế hoạch nội dung 30 ngày theo tuần"
      />
      <EmptyState
        icon={Map}
        title="Chưa có chiến lược"
        description="Hoàn thành Onboarding và xác nhận Persona & Trụ cột trước khi tạo chiến lược."
      />
    </>
  );
}
