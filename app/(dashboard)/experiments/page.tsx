import { PageHeader } from "@/components/layout/PageHeader";
import { ExperimentWorkbench } from "@/components/experiments/ExperimentWorkbench";
import { db } from "@/lib/db";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";

export const dynamic = "force-dynamic";

export default async function ExperimentsPage() {
  const tenant = await resolveLocalTenant(db);
  const experiments = await db.experiment.findMany({
    where: { organizationId: tenant.organizationId, brandId: tenant.brandId },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return (
    <>
      <PageHeader
        title="Experiments"
        description="Hypotheses, controls, variants and measurement. Conclusions become reviewable learning—not automatic prompt mutation."
      />
      <ExperimentWorkbench
        initial={experiments.map((item) => ({
          id: item.id,
          hypothesis: item.hypothesis,
          entityType: item.entityType,
          primaryMetric: item.primaryMetric,
          status: item.status,
          variants: item.variants,
          analysis: item.analysis,
          conclusion: item.conclusion,
        }))}
      />
    </>
  );
}
