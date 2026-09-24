import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ReviewPanel } from "@/components/review/ReviewPanel";
import { LearningQueue } from "@/components/learning/LearningQueue";
import { getReviewData } from "./actions";
import { db } from "@/lib/db";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";
import { resolveEvidenceRefs } from "@/lib/piltover/vnext/evidence-service";

export const dynamic = "force-dynamic";

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export default async function ReviewPage() {
  const tenant = await resolveLocalTenant(db);
  const [data, recommendations] = await Promise.all([
    getReviewData(),
    db.recommendation.findMany({
      where: { organizationId: tenant.organizationId, brandId: tenant.brandId },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);

  const learningRows = await Promise.all(recommendations.map(async (row) => {
    const refs = stringArray(row.evidenceRefs);
    const resolved = await resolveEvidenceRefs(db, refs);
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      rationale: row.rationale,
      evidenceRefs: refs,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      evidence: resolved.evidence.map((item) => ({
        id: item.id,
        sourceType: item.sourceType,
        sourceRef: item.sourceRef,
        content: item.content,
        confidence: item.confidence,
        freshness: item.freshness,
        capturedAt: item.capturedAt.toISOString(),
      })),
      performanceSnapshots: resolved.snapshots.map((item) => ({
        id: item.id,
        entityType: item.entityType,
        entityId: item.entityId,
        metrics: item.metrics,
        source: item.source,
        provider: item.provider,
        provenance: item.provenance,
        lineage: item.lineage,
        attributionStatus: item.attributionStatus,
        capturedAt: item.capturedAt.toISOString(),
      })),
    };
  }));

  return (
    <>
      <PageHeader
        title="Review & Learning"
        description="Human review for recommendations, evidence and strategy revisions. Production behavior changes only after explicit approval."
      />

      <LearningQueue initial={learningRows} />

      <section className="mt-10 space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Strategy review</h2>
          <p className="mt-1 text-xs text-muted-foreground">Weekly performance review remains versioned and separate from the learning recommendation queue.</p>
        </div>
        {!data.hasStrategy ? (
          <EmptyState
            icon={ClipboardList}
            title="No Strategy To Review"
            description="Hãy tạo chiến lược ở tab Chiến lược trước khi đánh giá tuần."
          />
        ) : (
          <ReviewPanel
            versionPerf={data.versionPerf}
            weekNumber={data.weekNumber}
          />
        )}
      </section>
    </>
  );
}
