import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { RunEventSchema, type RunEvent } from "../../../shared/contracts/control-plane";
import { stableHash } from "../../../shared/contracts/stable-json";
import type { ClockPort } from "../../../shared/ports/core-ports";
import type { EventAuthority, ExternalActor, RunEventPort } from "../../../shared/ports/control-plane-ports";
import { PrismaTenantAccess } from "../../identity/infrastructure/prisma-tenant-access";

const systemClock: ClockPort = { now: () => new Date() };
const SECRET_KEY = /(password|bearer.?token|api.?key|private.?key|secret|credential|authorization)/i;

function containsSecretKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsSecretKey);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(
    ([key, nested]) => SECRET_KEY.test(key) || containsSecretKey(nested),
  );
}

export class PrismaRunEvents implements RunEventPort {
  constructor(
    private readonly db: PrismaClient,
    private readonly clock: ClockPort = systemClock,
  ) {}

  async append(input: RunEvent, authority: EventAuthority) {
    const event = RunEventSchema.parse(input);
    if (containsSecretKey(event.payload)) throw new Error("AGENT_EVENT_SECRET_REJECTED");
    const contentHash = stableHash(event);
    try {
      return await this.db.$transaction(async (tx) => {
        const run = await tx.agentRun.findUnique({ where: { id: event.runId } });
        if (!run) throw new Error("AGENT_RUN_NOT_FOUND");
        const existing = await tx.runEvent.findUnique({
          where: { runId_sequence: { runId: event.runId, sequence: event.sequence } },
        });
        if (existing) {
          if (existing.contentHash === contentHash) return existing;
          throw new Error("AGENT_EVENT_SEQUENCE_CONFLICT");
        }
        if (["COMPLETED", "FAILED", "CANCELLED"].includes(run.status)) {
          throw new Error("AGENT_RUN_TERMINAL");
        }
        if (authority.type === "WORKER") {
          if (event.workerId !== authority.workerId) throw new Error("WORKER_IDENTITY_MISMATCH");
          await this.requireWorkerAuthority(tx, event.runId, authority.workerId, authority.leaseId);
        } else if (event.workerId) {
          throw new Error("WORKER_LEASE_REQUIRED");
        }
        const latest = await tx.runEvent.findFirst({
          where: { runId: event.runId }, orderBy: { sequence: "desc" }, select: { sequence: true },
        });
        const expected = (latest?.sequence ?? -1) + 1;
        if (event.sequence !== expected) throw new Error("AGENT_EVENT_SEQUENCE_GAP");
        return tx.runEvent.create({
          data: {
            id: randomUUID(), runId: event.runId, sequence: event.sequence,
            eventType: event.eventType, timestamp: new Date(event.timestamp),
            correlationId: event.correlationId, payload: event.payload as Prisma.InputJsonValue | undefined,
            workerId: event.workerId ?? null,
            leaseId: authority.type === "WORKER" ? authority.leaseId : null,
            contentHash,
          },
        });
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Unique constraint")) {
        const existing = await this.db.runEvent.findUnique({
          where: { runId_sequence: { runId: event.runId, sequence: event.sequence } },
        });
        if (existing?.contentHash === contentHash) return existing;
        throw new Error("AGENT_EVENT_SEQUENCE_CONFLICT");
      }
      throw error;
    }
  }

  async readAfter(actor: ExternalActor, runId: string, afterSequence: number) {
    if (!Number.isInteger(afterSequence) || afterSequence < -1) throw new Error("AGENT_EVENT_SEQUENCE_INVALID");
    const run = await this.db.agentRun.findUnique({ where: { id: runId } });
    if (!run) throw new Error("AGENT_RUN_NOT_FOUND");
    const target = run.brandId
      ? { type: "BRAND" as const, id: run.brandId }
      : run.workspaceId
        ? { type: "WORKSPACE" as const, id: run.workspaceId }
        : { type: "ORGANIZATION" as const, id: run.organizationId };
    const capability = target.type === "ORGANIZATION" ? "organization.read" : "agent.run";
    const decision = await new PrismaTenantAccess(this.db).authorize(actor, target, capability);
    if (!decision.allowed) throw new Error(`PERMISSION_DENIED:${decision.reason}`);
    const latest = await this.db.runEvent.findFirst({
      where: { runId }, orderBy: { sequence: "desc" }, select: { sequence: true },
    });
    if (afterSequence > (latest?.sequence ?? -1)) throw new Error("AGENT_EVENT_SEQUENCE_AHEAD");
    return this.db.runEvent.findMany({
      where: { runId, sequence: { gt: afterSequence } }, orderBy: { sequence: "asc" },
    });
  }

  private async requireWorkerAuthority(
    tx: Prisma.TransactionClient,
    runId: string,
    workerId: string,
    leaseId: string,
  ): Promise<void> {
    const job = await tx.job.findUnique({ where: { runId }, include: { currentLease: true } });
    if (!job || job.currentLeaseId !== leaseId || job.currentLease?.workerId !== workerId) {
      throw new Error("WORKER_STALE_LEASE");
    }
    if (job.currentLease.expiresAt <= this.clock.now() || job.currentLease.endedAt) {
      throw new Error("WORKER_LEASE_EXPIRED");
    }
    const worker = await tx.worker.findUnique({ where: { id: workerId } });
    if (!worker || worker.status !== "ACTIVE") throw new Error("WORKER_DISABLED");
    const authorized = job.brandId
      ? await tx.workerBrandGrant.findFirst({
          where: {
            workerId, organizationId: job.organizationId, workspaceId: job.workspaceId,
            brandId: job.brandId, status: "ACTIVE",
            organization: { status: "ACTIVE" }, workspace: { status: "ACTIVE" }, brand: { status: "ACTIVE" },
          },
        })
      : await tx.workerWorkspaceGrant.findFirst({
          where: {
            workerId, organizationId: job.organizationId, workspaceId: job.workspaceId,
            status: "ACTIVE", organization: { status: "ACTIVE" }, workspace: { status: "ACTIVE" },
          },
        });
    if (!authorized) throw new Error("WORKER_TENANT_GRANT_REQUIRED");
  }
}
