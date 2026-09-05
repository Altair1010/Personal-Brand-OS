import type { PrismaClient } from "@prisma/client";
import type { ClockPort } from "../../../shared/ports/core-ports";

const systemClock: ClockPort = { now: () => new Date() };

export class PrismaControlPlaneHealth {
  constructor(
    private readonly db: PrismaClient,
    private readonly clock: ClockPort = systemClock,
    private readonly freshnessWindowMs = 60_000,
  ) {}

  async read() {
    const now = this.clock.now();
    await this.db.$queryRaw`SELECT 1`;
    const freshAfter = new Date(now.getTime() - this.freshnessWindowMs);
    const [jobs, registered, enabled, fresh, activeLeases, expiredLeases, waitingForWorker, running, waitingApproval] =
      await Promise.all([
        this.db.job.findMany({
          where: { status: { in: ["QUEUED", "RETRY_PENDING"] } },
          select: { status: true, nextAttemptAt: true, createdAt: true },
        }),
        this.db.worker.count(),
        this.db.worker.count({ where: { status: "ACTIVE" } }),
        this.db.worker.count({ where: { status: "ACTIVE", lastSeenAt: { gt: freshAfter } } }),
        this.db.workerLease.count({
          where: { endedAt: null, expiresAt: { gt: now }, currentJob: { isNot: null } },
        }),
        this.db.workerLease.count({
          where: { endedAt: null, expiresAt: { lte: now }, currentJob: { isNot: null } },
        }),
        this.db.agentRun.count({ where: { status: "WAITING_FOR_WORKER" } }),
        this.db.agentRun.count({ where: { status: "RUNNING" } }),
        this.db.agentRun.count({ where: { status: "WAITING_APPROVAL" } }),
      ]);

    const eligible = jobs.filter(
      (job) => job.status === "QUEUED" || (job.status === "RETRY_PENDING" && job.nextAttemptAt != null && job.nextAttemptAt <= now),
    );
    const oldest = eligible.reduce<Date | null>(
      (current, job) => !current || job.createdAt < current ? job.createdAt : current,
      null,
    );
    return {
      schemaVersion: "1.0" as const,
      checkedAt: now.toISOString(),
      controlPlane: { status: "OK" as const },
      database: { status: "OK" as const },
      queue: {
        queued: jobs.filter(({ status }) => status === "QUEUED").length,
        retryPending: jobs.filter(({ status }) => status === "RETRY_PENDING").length,
        eligible: eligible.length,
        oldestEligibleAgeMs: oldest ? Math.max(0, now.getTime() - oldest.getTime()) : null,
      },
      workers: { registered, enabled, fresh, stale: enabled - fresh },
      leases: { active: activeLeases, expiredAwaitingReconciliation: expiredLeases },
      runs: { waitingForWorker, running, waitingApproval },
    };
  }
}
