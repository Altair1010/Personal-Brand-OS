import type { Prisma, PrismaClient, RunEvent as RunEventRecord } from "@prisma/client";
import type { ClockPort } from "../../../shared/ports/core-ports";
import type { WorkerReconnectCommand, WorkerReconnectPort } from "../../../shared/ports/control-plane-ports";

export type ReconnectLeaseStatus = "CURRENT" | "EXPIRED" | "RECLAIMED" | "CANCELLED" | "UNAUTHORIZED" | "DISABLED";

const systemClock: ClockPort = { now: () => new Date() };

function requiredCapabilities(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error("QUEUE_CAPABILITY_DATA_INVALID");
  }
  return value as string[];
}

export class PrismaWorkerReconnect implements WorkerReconnectPort {
  constructor(
    private readonly db: PrismaClient,
    private readonly clock: ClockPort = systemClock,
  ) {}

  async reconnect(input: WorkerReconnectCommand) {
    const worker = await this.db.worker.findUnique({
      where: { id: input.workerId }, include: { capabilities: true },
    });
    if (!worker) throw new Error("WORKER_NOT_FOUND");
    const operational = worker.status === "ACTIVE" && worker.capabilityVersion === input.capabilityVersion;
    const workerStatus = worker.status !== "ACTIVE"
      ? "DISABLED"
      : worker.capabilityVersion !== input.capabilityVersion
        ? "CAPABILITY_VERSION_MISMATCH"
        : "ACTIVE";

    const leases: Array<{ jobId: string; leaseId: string; status: ReconnectLeaseStatus }> = [];
    for (const reported of input.leases) {
      const job = await this.db.job.findUnique({
        where: { id: reported.jobId }, include: { currentLease: true },
      });
      let status: ReconnectLeaseStatus;
      if (!operational) status = "DISABLED";
      else if (!job) status = "RECLAIMED";
      else if (job.status === "CANCELLED") status = "CANCELLED";
      else if (job.currentLeaseId !== reported.leaseId || job.currentLease?.workerId !== input.workerId) status = "RECLAIMED";
      else if (job.currentLease.endedAt || job.currentLease.expiresAt <= this.clock.now()) status = "EXPIRED";
      else if (!(await this.hasExactGrant(input.workerId, job))) status = "UNAUTHORIZED";
      else status = "CURRENT";
      leases.push({ ...reported, status });
    }

    const eventDeltas: Array<{ runId: string; afterSequence: number; events: RunEventRecord[] }> = [];
    if (operational) {
      for (const acknowledgement of input.acknowledgements) {
        if (!Number.isInteger(acknowledgement.sequence) || acknowledgement.sequence < -1) {
          throw new Error("AGENT_EVENT_SEQUENCE_INVALID");
        }
        const job = await this.db.job.findUnique({ where: { runId: acknowledgement.runId } });
        if (!job || !(await this.hasExactGrant(input.workerId, job))) throw new Error("WORKER_TENANT_GRANT_REQUIRED");
        const latest = await this.db.runEvent.findFirst({
          where: { runId: acknowledgement.runId }, orderBy: { sequence: "desc" }, select: { sequence: true },
        });
        if (acknowledgement.sequence > (latest?.sequence ?? -1)) throw new Error("AGENT_EVENT_SEQUENCE_INVALID");
        const events = await this.db.runEvent.findMany({
          where: { runId: acknowledgement.runId, sequence: { gt: acknowledgement.sequence } },
          orderBy: { sequence: "asc" },
        });
        eventDeltas.push({ runId: acknowledgement.runId, afterSequence: acknowledgement.sequence, events });
      }
    }

    return {
      workerStatus,
      leases,
      eventDeltas,
      eligibleJobCount: operational ? await this.countEligibleJobs(worker) : 0,
    };
  }

  private async countEligibleJobs(worker: { id: string; capabilities: { capability: string }[] }): Promise<number> {
    const available = new Set(worker.capabilities.map(({ capability }) => capability));
    const jobs = await this.db.job.findMany({ where: { status: "QUEUED", currentLeaseId: null } });
    let count = 0;
    for (const job of jobs) {
      if (!requiredCapabilities(job.requiredCapabilities).every((capability) => available.has(capability))) continue;
      if (await this.hasExactGrant(worker.id, job)) count += 1;
    }
    return count;
  }

  private async hasExactGrant(
    workerId: string,
    job: { organizationId: string; workspaceId: string; brandId: string | null },
  ): Promise<boolean> {
    if (job.brandId) {
      return Boolean(await this.db.workerBrandGrant.findFirst({
        where: {
          workerId, organizationId: job.organizationId, workspaceId: job.workspaceId,
          brandId: job.brandId, status: "ACTIVE", organization: { status: "ACTIVE" },
          workspace: { status: "ACTIVE" }, brand: { status: "ACTIVE" },
        },
      }));
    }
    return Boolean(await this.db.workerWorkspaceGrant.findFirst({
      where: {
        workerId, organizationId: job.organizationId, workspaceId: job.workspaceId,
        status: "ACTIVE", organization: { status: "ACTIVE" }, workspace: { status: "ACTIVE" },
      },
    }));
  }
}
