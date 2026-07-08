import { PenSquare } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export default function StudioPage() {
  return (
    <>
      <PageHeader
        title="Studio sáng tạo"
        description="Soạn thảo và quản lý bài đăng"
      />
      <EmptyState
        icon={PenSquare}
        title="Chưa có bài viết nào"
        description="Tạo bài viết mới hoặc phê duyệt bản nháp từ chiến lược."
      />
    </>
  );
}
