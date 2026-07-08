import { CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export default function CalendarPage() {
  return (
    <>
      <PageHeader
        title="Lịch đăng bài"
        description="Xem và quản lý lịch trình nội dung 30 ngày"
      />
      <EmptyState
        icon={CalendarDays}
        title="Lịch trống"
        description="Tạo chiến lược để xem lịch đăng bài được lên kế hoạch."
      />
    </>
  );
}
