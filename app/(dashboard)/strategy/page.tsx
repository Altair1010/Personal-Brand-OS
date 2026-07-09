import Link from "next/link";
import { Lock, Map } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { getAudiencePillarsData } from "@/app/(dashboard)/audience-pillars/actions";

// Strategy is gated behind the audience/pillar review. Until AppState.audienceApprovedAt is
// set, render a locked EmptyState pointing back at /audience-pillars — no builder is exposed.
// M6 will build the actual 30-day builder behind this gate.

export const dynamic = "force-dynamic";

export default async function StrategyPage() {
  const { approvedAt } = await getAudiencePillarsData();

  if (!approvedAt) {
    return (
      <>
        <PageHeader
          title="Chiến lược nội dung"
          description="Lập kế hoạch nội dung 30 ngày theo tuần"
        />
        <EmptyState
          icon={Lock}
          title="Chưa duyệt Khán giả & Trụ cột"
          description="Hãy xác nhận Persona & Trụ cột và bấm “Duyệt & tạo chiến lược” trước khi vào bước này."
        />
        <div className="flex justify-center">
          <Button asChild>
            <Link href="/audience-pillars">Tới Khán giả & Trụ cột</Link>
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Chiến lược nội dung"
        description="Lập kế hoạch nội dung 30 ngày theo tuần"
      />
      <EmptyState
        icon={Map}
        title="Chưa có chiến lược"
        description="Đã mở khoá. Trình dựng chiến lược 30 ngày sẽ có ở bước tiếp theo."
      />
    </>
  );
}
