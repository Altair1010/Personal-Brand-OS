import { PenSquare } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/EmptyState";

interface Props {
  params: Promise<{ draftId: string }>;
}

export default async function StudioDraftPage({ params }: Props) {
  const { draftId } = await params;

  return (
    <>
      <PageHeader
        title="Chỉnh sửa bản nháp"
        description={`Bản nháp: ${draftId}`}
      />
      <EmptyState
        icon={PenSquare}
        title="Chưa có nội dung"
        description="Bản nháp này chưa có nội dung."
      />
    </>
  );
}
