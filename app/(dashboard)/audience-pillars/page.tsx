import { Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export default function AudiencePillarsPage() {
  return (
    <>
      <PageHeader
        title="Khán giả & Trụ cột nội dung"
        description="Xác định đối tượng mục tiêu và các trụ cột nội dung chính"
      />
      <EmptyState
        icon={Users}
        title="Chưa có khán giả & trụ cột"
        description="Hãy định nghĩa persona và trụ cột nội dung để xây dựng chiến lược."
      />
    </>
  );
}
