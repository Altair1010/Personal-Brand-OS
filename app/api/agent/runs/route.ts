import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const tenant = await resolveLocalTenant(db);
  const runs = await db.agentRun.findMany({
    where: {
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      brandId: tenant.brandId,
    },
    orderBy: { updatedAt: "desc" },
    take: 12,
    include: {
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          attemptCount: true,
          maxAttempts: true,
          currentLeaseId: true,
        },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    runs: runs.map((run) => {
      const task =
        run.task && typeof run.task === "object" && !Array.isArray(run.task)
          ? (run.task as Record<string, unknown>)
          : {};
      const job = run.jobs[0] ?? null;
      return {
        id: run.id,
        status: run.status,
        roleRef: run.roleRef,
        taskType: typeof task.type === "string" ? task.type : "AGENT_TASK",
        updatedAt: run.updatedAt.toISOString(),
        createdAt: run.createdAt.toISOString(),
        completedAt: run.completedAt?.toISOString() ?? null,
        job: job
          ? {
              id: job.id,
              status: job.status,
              attemptCount: job.attemptCount,
              maxAttempts: job.maxAttempts,
              leased: Boolean(job.currentLeaseId),
            }
          : null,
      };
    }),
  });
}
