import { PageHeader } from "@/components/layout/PageHeader";
import { StudioList } from "@/components/content/StudioList";
import { getStudioData } from "./actions";

export const revalidate = 30;

export default async function StudioPage() {
  const data = await getStudioData();

  return (
    <>
      <PageHeader
        title="Studio"
        description="Soạn thảo và quản lý bài đăng"
      />
      <StudioList
        drafts={data.drafts}
        ideasWithoutDraft={data.ideasWithoutDraft}
      />
    </>
  );
}
