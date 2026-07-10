import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { DraftEditor } from "@/components/content/DraftEditor";
import { getDraft } from "../actions";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ draftId: string }>;
}

export default async function StudioDraftPage({ params }: Props) {
  const { draftId } = await params;
  const data = await getDraft(draftId);

  if (!data) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title={data.draft.title}
        description={`Bản nháp phiên bản ${data.draft.version}`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/studio">Quay lại</Link>
          </Button>
        }
      />
      <DraftEditor
        draft={data.draft}
        frameworks={data.frameworks}
        context={data.context}
      />
    </>
  );
}
