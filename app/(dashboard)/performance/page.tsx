import { BarChart2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export default function PerformancePage() {
  return (
    <>
      <PageHeader
        title="Hiệu suất"
        description="Theo dõi chỉ số reach, engagement, comments và saves"
      />
      <EmptyState
        icon={BarChart2}
        title="Chưa có dữ liệu hiệu suất"
        description="Đăng bài và nhập chỉ số thủ công để theo dõi hiệu suất."
      />
    </>
  );
}
