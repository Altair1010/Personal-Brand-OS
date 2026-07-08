import { UserCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export default function OnboardingPage() {
  return (
    <>
      <PageHeader
        title="Onboarding"
        description="Thiết lập thương hiệu cá nhân của bạn"
      />
      <EmptyState
        icon={UserCheck}
        title="Chưa hoàn thành Onboarding"
        description="Điền thông tin thương hiệu, persona và mục tiêu để bắt đầu."
      />
    </>
  );
}
