import type { PrismaClient } from "@prisma/client";
import { authorizeToolAction } from "@/lib/piltover/vnext/tool-policy";
import { runPublishingSchedulerCycle } from "@/lib/piltover/vnext/publishing-engine";
import { stableHash } from "@/lib/piltover/shared/contracts/stable-json";

export async function runAuthorizedPublishingSchedulerCycle(
  db: PrismaClient,
  input: { workerId: string; limit?: number; leaseMs?: number; now?: Date },
) {
  const now = input.now ?? new Date();
  const due = await db.publishingJob.findMany({
    where: {
      status: { in: ["QUEUED", "RETRY_PENDING"] },
      AND: [
        { OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }] },
        { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
      ],
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
    take: Math.max(1, Math.min(input.limit ?? 10, 100)),
  });

  for (const job of due) {
    const brand = await db.brand.findUnique({
      where: { id: job.brandId },
      select: { workspaceId: true },
    });
    if (!brand) continue;
    const decision = await authorizeToolAction(db, {
      organizationId: job.organizationId,
      workspaceId: brand.workspaceId,
      brandId: job.brandId,
      agentDefinitionId: null,
      toolNamespace: "publishing",
      action: "publish",
      mode: "write",
    });
    if (decision.allowed) continue;

    const reason = decision.reason === "APPROVAL_REQUIRED" ? "APPROVAL_REQUIRED" : `TOOL_${decision.reason}`;
    const approval = decision.reason === "APPROVAL_REQUIRED"
      ? await db.approvalRequest.findFirst({
          where: {
            organizationId: job.organizationId,
            brandId: job.brandId,
            actionType: "publishing.publish",
            targetRef: `publishing-job:${job.id}`,
            payloadHash: stableHash(job.providerPayload),
            status: "APPROVED",
            expiresAt: { gt: now },
          },
          orderBy: { decidedAt: "desc" },
        })
      : null;

    if (!approval || !approval.consumedAt) {
      await db.publishingJob.update({
        where: { id: job.id },
        data: {
          status: decision.reason === "APPROVAL_REQUIRED" ? "WAITING_APPROVAL" : "BLOCKED",
          blockedReason: reason,
          errorCategory: decision.reason === "APPROVAL_REQUIRED" ? null : "PROVIDER_REJECTED",
          error: reason,
          leaseOwner: null,
          leaseExpiresAt: null,
          nextAttemptAt: null,
        },
      });
    }
  }

  return runPublishingSchedulerCycle(db, input);
}
