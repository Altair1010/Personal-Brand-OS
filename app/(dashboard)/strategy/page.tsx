import Link from "next/link";
import { Lock } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { StrategyWizard } from "@/components/strategy/StrategyWizard";
import { getStrategyData } from "./actions";

// Strategy is gated behind the audience/pillar review. Until AppState.audienceApprovedAt is
// set, render a locked EmptyState pointing back at /audience-pillars. Once approved, the
// 30-day builder (StrategyWizard) is exposed with the current strategy if one exists.

export const dynamic = "force-dynamic";

export default async function StrategyPage() {
  const data = await getStrategyData();

  if (!data.approvedAt) {
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
      <StrategyWizard
        brand={data.brand}
        goal={data.goal}
        personas={data.personas}
        pillars={data.pillars}
        frameworks={data.frameworks}
        initialStrategy={data.strategy}
      />
    </>
  );
}
