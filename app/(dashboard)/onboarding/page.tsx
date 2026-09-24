import { PageHeader } from "@/components/layout/PageHeader";
import { OnboardingWizard } from "@/components/brand/OnboardingWizard";
import { getOnboardingData } from "./actions";
import type { BrandDnaInput } from "@/lib/validators/brandDna";
import { normalizeRecordTo100 } from "@/lib/strategy-engine/normalizeRatio";

// Server component: load persisted BrandDNA + active Goal, then hand the client wizard a
// plain-serializable draft. Dates become yyyy-mm-dd strings for <input type="date">.

export const revalidate = 30;

function toDateInput(d: Date | null | undefined): string | undefined {
  return d ? d.toISOString().slice(0, 10) : undefined;
}

export default async function OnboardingPage() {
  const { brandDna, goal } = await getOnboardingData();

  const initial = {
    brand: {
      whoAmI: brandDna?.whoAmI ?? undefined,
      field: brandDna?.field ?? undefined,
      threeWords: (brandDna?.threeWords as string[] | null) ?? undefined,
      coreBeliefs: brandDna?.coreBeliefs ?? undefined,
      differentiation: brandDna?.differentiation ?? undefined,
      personalStory: brandDna?.personalStory ?? undefined,
      expertise: brandDna?.expertise ?? undefined,
      customerProfile: brandDna?.customerProfile ?? undefined,
      customerPain: brandDna?.customerPain ?? undefined,
      customerMisunderstanding: brandDna?.customerMisunderstanding ?? undefined,
      marketEducationGoal: brandDna?.marketEducationGoal ?? undefined,
      companyName: brandDna?.companyName ?? undefined,
      offers: (brandDna?.offers as string[] | null) ?? undefined,
      usp: brandDna?.usp ?? undefined,
      region: brandDna?.region ?? undefined,
      aiPositioning: brandDna?.aiPositioning ?? undefined,
      sourceFiles: (brandDna?.sourceFiles as string[] | null) ?? undefined,
    } satisfies BrandDnaInput,
    goal: {
      name: goal?.name ?? "",
      goalType: goal?.goalType ?? "",
      timeRangeStart: toDateInput(goal?.timeRangeStart),
      timeRangeEnd: toDateInput(goal?.timeRangeEnd),
      targetAudience: goal?.targetAudience ?? undefined,
      mainOffer: goal?.mainOffer ?? undefined,
      mainMessage: goal?.mainMessage ?? undefined,
      kpi:
        (goal?.kpi as { metric: string; target?: string; unit?: string }[] | null) ?? undefined,
      contentRatio:
        goal?.contentRatio && typeof goal.contentRatio === "object" && !Array.isArray(goal.contentRatio)
          ? normalizeRecordTo100(goal.contentRatio as Record<string, number>)
          : undefined,
      risk: goal?.risk ?? undefined,
      successDefinition: goal?.successDefinition ?? undefined,
    },
  };

  return (
    <>
      <PageHeader
        title="Onboarding"
        description="Thiết lập nền tảng thương hiệu, Objective và KPI"
      />
      <OnboardingWizard initial={initial} />
    </>
  );
}
