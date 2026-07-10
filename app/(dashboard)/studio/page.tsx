import { PageHeader } from "@/components/layout/PageHeader";
import { StudioList } from "@/components/content/StudioList";
import { getStudioData } from "./actions";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const data = await getStudioData();

  return (
    <>
      <PageHeader
        title="Studio sáng tạo"
        description="Soạn thảo và quản lý bài đăng"
      />
      <StudioList
        drafts={data.drafts}
        ideasWithoutDraft={data.ideasWithoutDraft}
      />
    </>
  );
}
