import { Settings } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Cài đặt"
        description="Quản lý cấu hình ứng dụng và model AI"
      />
      <EmptyState
        icon={Settings}
        title="Cài đặt chưa được cấu hình"
        description="Chọn model AI và cấu hình các tùy chọn hệ thống."
      />
    </>
  );
}
