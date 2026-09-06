import type { Prisma, PrismaClient } from "@prisma/client";
import { WorkerExecutionEnvelopeSchema, type WorkerExecutionEnvelope } from "../../../shared/contracts/worker-bridge";
import type { ClockPort } from "../../../shared/ports/core-ports";
import type { WorkerExecutionEnvelopePort } from "../../../shared/ports/worker-bridge-ports";

const systemClock: ClockPort = { now: () => new Date() };

function stringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new Error("QUEUE_CAPABILITY_DATA_INVALID");
  return [...new Set(value as string[])].sort();
}

function repositoryAlias(task: Prisma.JsonValue): string {
  if (!task || typeof task !== "object" || Array.isArray(task) || !("repositoryAlias" in task) ||
      typeof task.repositoryAlias !== "string") throw new Error("WORKER_REPOSITORY_ALIAS_REQUIRED");
  return task.repositoryAlias;
}

export class PrismaExecutionEnvelope implements WorkerExecutionEnvelopePort {
  constructor(private readonly db: PrismaClient, private readonly clock: ClockPort = systemClock) {}

  async get(workerId: string, jobId: string, leaseId: string): Promise<WorkerExecutionEnvelope> {
    const job = await this.db.job.findUnique({
      where: { id: jobId },
      include: {
        run: true, currentLease: true,
        organization: true, workspace: true, brand: true,
      },
    });
    if (!job) throw new Error("QUEUE_JOB_NOT_FOUND");
    const lease = job.currentLease;
    if (!lease || job.currentLeaseId !== leaseId || lease.id !== leaseId || lease.workerId !== workerId ||
        lease.endedAt || lease.expiresAt.getTime() <= this.clock.now().getTime()) throw new Error("WORKER_STALE_LEASE");
    if (!["CLAIMED", "RUNNING"].includes(job.status) ||
        !["CLAIMED", "RUNNING"].includes(job.run.status)) throw new Error("AGENT_RUN_NOT_EXECUTABLE");
    const worker = await this.db.worker.findUnique({ where: { id: workerId }, include: { capabilities: true } });
    if (!worker || worker.status !== "ACTIVE") throw new Error("WORKER_DISABLED");
    const requiredCapabilities = stringArray(job.requiredCapabilities);
    const workerCapabilities = new Set(worker.capabilities.map(({ capability }) => capability));
    if (requiredCapabilities.some((capability) => !workerCapabilities.has(capability))) throw new Error("WORKER_CAPABILITY_MISMATCH");
    if (job.organization.status !== "ACTIVE" || job.workspace.status !== "ACTIVE" ||
        job.workspace.organizationId !== job.organizationId ||
        (job.brand && (job.brand.status !== "ACTIVE" || job.brand.organizationId !== job.organizationId || job.brand.workspaceId !== job.workspaceId))) {
      throw new Error("TENANT_INVALID_ANCESTRY");
    }
    const grant = job.brandId
      ? await this.db.workerBrandGrant.findUnique({ where: { workerId_brandId: { workerId, brandId: job.brandId } } })
      : await this.db.workerWorkspaceGrant.findUnique({ where: { workerId_workspaceId: { workerId, workspaceId: job.workspaceId } } });
    if (!grant || grant.status !== "ACTIVE" || grant.organizationId !== job.organizationId ||
        grant.workspaceId !== job.workspaceId || ("brandId" in grant && grant.brandId !== job.brandId)) {
      throw new Error("WORKER_TENANT_GRANT_REQUIRED");
    }
    return WorkerExecutionEnvelopeSchema.parse({
      schemaVersion: "1.0", runId: job.runId, jobId: job.id, leaseId,
      correlationId: job.run.correlationId, organizationId: job.organizationId,
      workspaceId: job.workspaceId, brandId: job.brandId, task: job.run.task,
      roleRef: job.run.roleRef, contextRef: job.run.contextRef,
      permissionManifestRef: job.run.permissionManifestRef,
      requiredCapabilities, repositoryAlias: repositoryAlias(job.run.task),
    });
  }
}
