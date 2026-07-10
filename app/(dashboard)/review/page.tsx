import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ReviewPanel } from "@/components/review/ReviewPanel";
import { getReviewData } from "./actions";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const data = await getReviewData();

  return (
    <>
      <PageHeader
        title="Đánh giá tuần"
        description="Tổng kết và rút kinh nghiệm từng tuần"
      />

      {!data.hasStrategy ? (
        <EmptyState
          icon={ClipboardList}
          title="Chưa có chiến lược để đánh giá"
          description="Hãy tạo chiến lược ở tab Chiến lược trước khi đánh giá tuần."
        />
      ) : (
        <ReviewPanel
          versionPerf={data.versionPerf}
          weekNumber={data.weekNumber}
        />
      )}
    </>
  );
}
