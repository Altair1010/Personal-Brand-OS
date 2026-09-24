import { Megaphone } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { CampaignWorkspace } from "@/components/marketing/CampaignWorkspace";
import { getCampaignWorkspaceData } from "./actions";

export const revalidate = 30;

export default async function CampaignsPage() {
  const data = await getCampaignWorkspaceData();

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Nối chiến lược với Organic delivery, Meta Ads và performance evidence"
      />
      {!data.strategyVersionId ? (
        <EmptyState
          icon={Megaphone}
          title="No Active Strategy"
          description="Tạo chiến lược trước, sau đó dùng chiến dịch để chạy golden path H1."
        />
      ) : (
        <CampaignWorkspace data={data} />
      )}
    </>
  );
}
