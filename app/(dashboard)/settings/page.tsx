import { PageHeader } from "@/components/layout/PageHeader";
import { AiModelConfigForm } from "@/components/settings/AiModelConfigForm";
import { BackupPanel } from "@/components/settings/BackupPanel";
import { DangerZone } from "@/components/settings/DangerZone";
import { getSettingsData } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const data = await getSettingsData();

  return (
    <>
      <PageHeader
        title="Cài đặt"
        description="Quản lý model AI, sao lưu dữ liệu và reset hệ thống"
      />
      <div className="space-y-6">
        <AiModelConfigForm configs={data.configs} active={data.active} />
        <BackupPanel />
        <DangerZone />
      </div>
    </>
  );
}
