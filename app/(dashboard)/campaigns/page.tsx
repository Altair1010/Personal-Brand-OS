import { Megaphone } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { CampaignWorkspace } from "@/components/marketing/CampaignWorkspace";
import { getCampaignWorkspaceData } from "./actions";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const data = await getCampaignWorkspaceData();

  return (
    <>
      <PageHeader
        title="Chiến dịch"
        description="Nối chiến lược với Organic delivery, Meta Ads và performance evidence"
      />
      {!data.strategyVersionId ? (
        <EmptyState
          icon={Megaphone}
          title="Chưa có chiến lược hoạt động"
          description="Tạo chiến lược trước, sau đó dùng chiến dịch để chạy golden path H1."
        />
      ) : (
        <CampaignWorkspace data={data} />
      )}
    </>
  );
}
