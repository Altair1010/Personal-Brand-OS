import Link from "next/link";
import { Target } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { AudiencePillarsBoard } from "@/components/audience/AudiencePillarsBoard";
import { getAudiencePillarsData } from "./actions";
import type { BrandDnaContext, GoalContext } from "@/components/audience/types";

// Server component: load persona/pillar state for the active goal, then hand the client
// board plain-serializable props. No goal → EmptyState pointing at onboarding.

export const dynamic = "force-dynamic";

export default async function AudiencePillarsPage() {
  const { brandDna, goal, segments, pillars, approvedAt } =
    await getAudiencePillarsData();

  if (!goal) {
    return (
      <>
        <PageHeader
          title="Khán giả & Trụ cột nội dung"
          description="Xác định đối tượng mục tiêu và các trụ cột nội dung chính"
        />
        <EmptyState
          icon={Target}
          title="Chưa có mục tiêu"
          description="Hãy hoàn thành Onboarding và tạo một mục tiêu đang hoạt động trước khi dựng persona & trụ cột."
        />
        <div className="flex justify-center">
          <Button asChild>
            <Link href="/onboarding">Tới Onboarding</Link>
          </Button>
        </div>
      </>
    );
  }

  const brandContext: BrandDnaContext = {
    whoAmI: brandDna?.whoAmI ?? undefined,
    field: brandDna?.field ?? undefined,
    positioning: brandDna?.aiPositioning ?? undefined,
    threeWords: Array.isArray(brandDna?.threeWords)
      ? (brandDna?.threeWords as unknown[]).filter(
          (w): w is string => typeof w === "string",
        )
      : undefined,
    differentiationSharpened: brandDna?.differentiation ?? undefined,
    summary: brandDna?.usp ?? undefined,
  };

  const goalContext: GoalContext = {
    name: goal.name,
    goalType: goal.goalType,
    targetAudience: goal.targetAudience ?? undefined,
    mainOffer: goal.mainOffer ?? undefined,
  };

  return (
    <>
      <PageHeader
        title="Khán giả & Trụ cột nội dung"
        description="Dựng persona và trụ cột nội dung, rồi duyệt để mở khoá Chiến lược"
      />
      <AudiencePillarsBoard
        brand={brandContext}
        goal={goalContext}
        initialSegments={segments}
        initialPillars={pillars}
        initialApprovedAt={approvedAt}
      />
    </>
  );
}
