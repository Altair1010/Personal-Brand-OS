import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export default function ReviewPage() {
  return (
    <>
      <PageHeader
        title="Đánh giá tuần"
        description="Tổng kết và rút kinh nghiệm từng tuần"
      />
      <EmptyState
        icon={ClipboardList}
        title="Chưa có đánh giá tuần"
        description="Hoàn thành ít nhất một tuần chiến lược để bắt đầu đánh giá."
      />
    </>
  );
}
