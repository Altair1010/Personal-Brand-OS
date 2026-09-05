import { randomUUID } from "node:crypto";
import type { Job as JobRecord, Prisma, PrismaClient } from "@prisma/client";
import { RunRequestSchema, RunResultSchema, type RunRequest, type RunResult } from "../../../shared/contracts/control-plane";
import { stableHash } from "../../../shared/contracts/stable-json";
import { containsObviousSecret } from "../../../shared/contracts/safe-metadata";
import type { ClockPort } from "../../../shared/ports/core-ports";
import type { ClaimedJob, EnqueueJobCommand, ExternalActor, JobQueuePort } from "../../../shared/ports/control-plane-ports";
import { PrismaTenantAccess } from "../../identity/infrastructure/prisma-tenant-access";
import { assertAgentRunTransition, assertJobTransition, type AgentRunStatus, type JobStatus } from "../domain/state-machines";

type Database = PrismaClient | Prisma.TransactionClient;

const systemClock: ClockPort = { now: () => new Date() };

function capabilities(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error("QUEUE_CAPABILITY_DATA_INVALID");
  }
  return [...new Set(value as string[])].sort();
}

function normalizeCapabilities(value: readonly string[]): string[] {
  const normalized = [...new Set(value.map((item) => item.trim()))].sort();
  if (normalized.some((item) => item.length === 0)) throw new Error("WORKER_CAPABILITY_INVALID");
  return normalized;
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export class PrismaJobQueue implements JobQueuePort {
  constructor(
    private readonly db: PrismaClient,
    private readonly clock: ClockPort = systemClock,
  ) {}

  async createRun(input: RunRequest, correlationId: string) {
    const request = RunRequestSchema.parse(input);
    await this.assertRunAncestry(request);
    const fingerprint = stableHash(request);
    const existing = await this.db.agentRun.findFirst({
      where: {
        OR: [
          { id: request.runId },
          ...(request.idempotencyKey
            ? [{ organizationId: request.organizationId, idempotencyKey: request.idempotencyKey }]
            : []),
        ],
      },
    });
    const acceptExisting = (candidate: typeof existing) => {
      if (!candidate) return null;
      if (candidate.requestFingerprint !== fingerprint) throw new Error("AGENT_IDEMPOTENCY_CONFLICT");
      return candidate;
    };
    if (existing) {
      if (existing.requestFingerprint !== fingerprint) throw new Error("AGENT_IDEMPOTENCY_CONFLICT");
      return existing;
    }
    try {
      return await this.db.agentRun.create({
        data: {
          id: request.runId,
          organizationId: request.organizationId,
          workspaceId: request.workspaceId ?? null,
          brandId: request.brandId ?? null,
          roleRef: request.roleRef,
          task: json(request.task),
          contextRef: json(request.contextRef),
          permissionManifestRef: request.permissionManifestRef,
          requiredCapabilities: json(normalizeCapabilities(request.requiredCapabilities ?? [])),
          idempotencyKey: request.idempotencyKey ?? null,
          requestFingerprint: fingerprint,
          correlationId,
        },
      });
    } catch (error) {
      const raced = await this.db.agentRun.findFirst({
        where: {
          OR: [
            { id: request.runId },
            ...(request.idempotencyKey
              ? [{ organizationId: request.organizationId, idempotencyKey: request.idempotencyKey }]
              : []),
          ],
        },
      });
      const accepted = acceptExisting(raced);
      if (accepted) return accepted;
      throw error;
    }
  }

  async getRun(actor: ExternalActor, runId: string) {
    const run = await this.db.agentRun.findUnique({ where: { id: runId } });
    if (!run) throw new Error("AGENT_RUN_NOT_FOUND");
    const target = run.brandId
      ? { type: "BRAND" as const, id: run.brandId }
      : run.workspaceId
        ? { type: "WORKSPACE" as const, id: run.workspaceId }
        : { type: "ORGANIZATION" as const, id: run.organizationId };
    const capability = target.type === "ORGANIZATION" ? "organization.read" : "work.read";
    const decision = await new PrismaTenantAccess(this.db).authorize(actor, target, capability);
    if (!decision.allowed) throw new Error(`PERMISSION_DENIED:${decision.reason}`);
    return run;
  }

  async enqueue(input: EnqueueJobCommand) {
    if (input.maxAttempts < 1) throw new Error("QUEUE_MAX_ATTEMPTS_INVALID");
    const run = await this.db.agentRun.findUnique({ where: { id: input.runId } });
    if (!run) throw new Error("AGENT_RUN_NOT_FOUND");
    const workspaceId = input.workspaceId ?? run.workspaceId;
    const brandId = "brandId" in input ? input.brandId ?? null : run.brandId;
    if (!workspaceId) throw new Error("WORKER_SCOPE_REQUIRED");
    await this.assertExecutionScope(run, workspaceId, brandId);
    const material = {
      id: input.id,
      runId: input.runId,
      idempotencyKey: input.idempotencyKey,
      organizationId: run.organizationId,
      workspaceId,
      brandId,
      requiredCapabilities: normalizeCapabilities(input.requiredCapabilities ?? capabilities(run.requiredCapabilities)),
      priority: input.priority ?? 50,
      maxAttempts: input.maxAttempts,
      nextAttemptAt: input.nextAttemptAt?.toISOString() ?? null,
    };
    const fingerprint = stableHash(material);
    const acceptExisting = (existing: JobRecord): JobRecord => {
      if (existing.idempotencyKey !== input.idempotencyKey || stableHash({
        id: existing.id, runId: existing.runId, idempotencyKey: existing.idempotencyKey,
        organizationId: existing.organizationId, workspaceId: existing.workspaceId, brandId: existing.brandId,
        requiredCapabilities: capabilities(existing.requiredCapabilities), priority: existing.priority,
        maxAttempts: existing.maxAttempts, nextAttemptAt: existing.nextAttemptAt?.toISOString() ?? null,
      }) !== fingerprint) throw new Error("QUEUE_IDEMPOTENCY_CONFLICT");
      return existing;
    };
    const existing = await this.db.job.findUnique({ where: { runId: input.runId } });
    if (existing) return acceptExisting(existing);

    try {
      return await this.db.$transaction(async (tx) => {
        const raced = await tx.job.findUnique({ where: { runId: input.runId } });
        if (raced) return acceptExisting(raced);
        const currentRun = await tx.agentRun.findUniqueOrThrow({ where: { id: input.runId } });
        assertAgentRunTransition(currentRun.status as AgentRunStatus, "WAITING_FOR_WORKER");
        const job = await tx.job.create({
          data: {
            id: input.id, runId: input.runId, organizationId: run.organizationId,
            workspaceId, brandId, priority: material.priority,
            requiredCapabilities: json(material.requiredCapabilities), idempotencyKey: input.idempotencyKey,
            maxAttempts: input.maxAttempts, nextAttemptAt: input.nextAttemptAt,
          },
        });
        await tx.agentRun.update({ where: { id: input.runId }, data: { status: "WAITING_FOR_WORKER" } });
        return job;
      });
    } catch (error) {
      const raced = await this.db.job.findUnique({ where: { runId: input.runId } });
      if (raced) return acceptExisting(raced);
      throw error;
    }
  }

  async claimEligible(workerId: string, leaseDurationMs: number): Promise<ClaimedJob | null> {
    if (leaseDurationMs <= 0) throw new Error("WORKER_LEASE_DURATION_INVALID");
    await this.activateDueRetries();
    const worker = await this.db.worker.findUnique({
      where: { id: workerId },
      include: { capabilities: true },
    });
    if (!worker || worker.status !== "ACTIVE" || worker.protocolVersion !== "1.0") return null;
    const workerCapabilities = new Set(worker.capabilities.map(({ capability }) => capability));
    const candidates = await this.db.job.findMany({
      where: { status: "QUEUED", currentLeaseId: null },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }, { id: "asc" }],
    });
    for (const candidate of candidates) {
      if (!capabilities(candidate.requiredCapabilities).every((required) => workerCapabilities.has(required))) continue;
      try {
        const claimed = await this.claimCandidate(candidate.id, workerId, leaseDurationMs);
        if (claimed) return claimed;
      } catch (error) {
        if (error instanceof Error && error.message === "QUEUE_CLAIM_CONFLICT") continue;
        throw error;
      }
    }
    return null;
  }

  async markRunning(jobId: string, workerId: string, leaseId: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const { job } = await this.requireLeaseAuthority(tx, jobId, workerId, leaseId);
      assertJobTransition(job.status as JobStatus, "RUNNING");
      const run = await tx.agentRun.findUniqueOrThrow({ where: { id: job.runId } });
      assertAgentRunTransition(run.status as AgentRunStatus, "RUNNING");
      await tx.job.update({ where: { id: job.id }, data: { status: "RUNNING" } });
      await tx.agentRun.update({ where: { id: run.id }, data: { status: "RUNNING" } });
    });
  }

  async renewLease(jobId: string, workerId: string, leaseId: string, leaseDurationMs: number): Promise<Date> {
    if (leaseDurationMs <= 0) throw new Error("WORKER_LEASE_DURATION_INVALID");
    return this.db.$transaction(async (tx) => {
      const { lease } = await this.requireLeaseAuthority(tx, jobId, workerId, leaseId);
      const expiresAt = new Date(this.clock.now().getTime() + leaseDurationMs);
      await tx.workerLease.update({ where: { id: lease.id }, data: { expiresAt } });
      return expiresAt;
    });
  }

  async reconcileExpiredLeases(retryDelayMs: number): Promise<number> {
    const now = this.clock.now();
    const expired = await this.db.job.findMany({
      where: {
        status: { in: ["CLAIMED", "RUNNING"] },
        currentLease: { expiresAt: { lte: now } },
      },
      select: { id: true },
    });
    let reconciled = 0;
    for (const { id } of expired) {
      const changed = await this.db.$transaction(async (tx) => {
        const job = await tx.job.findUnique({ where: { id }, include: { currentLease: true } });
        if (!job?.currentLease || job.currentLease.expiresAt > now || !["CLAIMED", "RUNNING"].includes(job.status)) return false;
        const exhausted = job.attemptCount >= job.maxAttempts;
        const nextJobStatus = exhausted ? "FAILED" : "RETRY_PENDING";
        assertJobTransition(job.status as JobStatus, nextJobStatus);
        const run = await tx.agentRun.findUniqueOrThrow({ where: { id: job.runId } });
        const preserveApprovalPause = !exhausted && run.status === "WAITING_APPROVAL";
        const nextRunStatus = exhausted ? "FAILED" : preserveApprovalPause ? "WAITING_APPROVAL" : "RETRY_PENDING";
        if (!preserveApprovalPause) assertAgentRunTransition(run.status as AgentRunStatus, nextRunStatus);
        await tx.workerLease.update({
          where: { id: job.currentLease.id }, data: { endedAt: now, endReason: "EXPIRED" },
        });
        await tx.job.update({
          where: { id: job.id },
          data: {
            status: nextJobStatus, currentLeaseId: null,
            nextAttemptAt: exhausted ? null : new Date(now.getTime() + retryDelayMs),
          },
        });
        if (!preserveApprovalPause) {
          await tx.agentRun.update({ where: { id: run.id }, data: { status: nextRunStatus } });
        }
        await this.audit(tx, job.organizationId, "SYSTEM", "lease-reconciler", exhausted ? "JOB_ATTEMPTS_EXHAUSTED" : "WORKER_LEASE_EXPIRED", "JOB", job.id, run.correlationId, now);
        return true;
      });
      if (changed) reconciled += 1;
    }
    return reconciled;
  }

  async complete(jobId: string, workerId: string, leaseId: string, input: RunResult): Promise<void> {
    const result = RunResultSchema.parse(input);
    if (containsObviousSecret(result.error?.details)) throw new Error("AGENT_RESULT_SECRET_REJECTED");
    const fingerprint = stableHash(result);
    await this.db.$transaction(async (tx) => {
      const job = await tx.job.findUnique({ where: { id: jobId }, include: { currentLease: true } });
      if (!job || result.runId !== job.runId) throw new Error("AGENT_RUN_NOT_FOUND");
      if (job.currentLeaseId !== leaseId || job.currentLease?.workerId !== workerId) throw new Error("WORKER_STALE_LEASE");
      if (["COMPLETED", "FAILED", "CANCELLED"].includes(job.status)) {
        if (job.terminalFingerprint === fingerprint) return;
        throw new Error("AGENT_TERMINAL_RESULT_CONFLICT");
      }
      await this.requireLeaseAuthority(tx, jobId, workerId, leaseId);
      assertJobTransition(job.status as JobStatus, result.status as JobStatus);
      const run = await tx.agentRun.findUniqueOrThrow({ where: { id: job.runId } });
      assertAgentRunTransition(run.status as AgentRunStatus, result.status as AgentRunStatus);
      const now = this.clock.now();
      await tx.workerLease.update({ where: { id: leaseId }, data: { endedAt: now, endReason: result.status } });
      await tx.job.update({ where: { id: job.id }, data: { status: result.status, terminalFingerprint: fingerprint } });
      await tx.agentRun.update({
        where: { id: run.id },
        data: {
          status: result.status, terminalResult: json(result), terminalFingerprint: fingerprint,
          completedAt: new Date(result.completedAt),
        },
      });
      await this.audit(tx, job.organizationId, "WORKER", workerId, "AGENT_RUN_TERMINAL", "AGENT_RUN", run.id, run.correlationId, now);
    });
  }

  async cancelRun(actor: ExternalActor, runId: string, correlationId: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const run = await tx.agentRun.findUnique({ where: { id: runId }, include: { jobs: true } });
      if (!run) throw new Error("AGENT_RUN_NOT_FOUND");
      const target = run.brandId
        ? { type: "BRAND" as const, id: run.brandId }
        : run.workspaceId
          ? { type: "WORKSPACE" as const, id: run.workspaceId }
          : { type: "ORGANIZATION" as const, id: run.organizationId };
      const capability = target.type === "ORGANIZATION" ? "organization.manage" : "agent.manage";
      const decision = await new PrismaTenantAccess(tx).authorize(actor, target, capability);
      if (!decision.allowed) throw new Error(`PERMISSION_DENIED:${decision.reason}`);
      if (run.status === "CANCELLED") return;
      if (["COMPLETED", "FAILED"].includes(run.status)) throw new Error("AGENT_TERMINAL_CONFLICT");
      assertAgentRunTransition(run.status as AgentRunStatus, "CANCELLED");
      const now = this.clock.now();
      for (const job of run.jobs) {
        if (["COMPLETED", "FAILED", "CANCELLED"].includes(job.status)) continue;
        assertJobTransition(job.status as JobStatus, "CANCELLED");
        if (job.currentLeaseId) {
          await tx.workerLease.update({
            where: { id: job.currentLeaseId }, data: { endedAt: now, endReason: "CANCELLED" },
          });
        }
        await tx.job.update({
          where: { id: job.id }, data: { status: "CANCELLED", currentLeaseId: null },
        });
      }
      await tx.approvalRequest.updateMany({
        where: { runId, status: "PENDING" }, data: { status: "CANCELLED", decidedAt: now },
      });
      await tx.agentRun.update({ where: { id: runId }, data: { status: "CANCELLED", completedAt: now } });
      const identity = await tx.authIdentity.findUnique({ where: { provider_subject: actor } });
      await this.audit(tx, run.organizationId, "HUMAN", identity?.userIdentityId ?? "unknown", "AGENT_RUN_CANCELLED", "AGENT_RUN", runId, correlationId, now);
    });
  }

  private async assertRunAncestry(request: RunRequest): Promise<void> {
    const organization = await this.db.organization.findUnique({ where: { id: request.organizationId } });
    if (!organization || organization.status !== "ACTIVE") throw new Error("TENANT_INVALID_ANCESTRY");
    if (request.brandId && !request.workspaceId) throw new Error("TENANT_INVALID_ANCESTRY");
    if (request.workspaceId) {
      const workspace = await this.db.workspace.findUnique({ where: { id: request.workspaceId } });
      if (!workspace || workspace.organizationId !== request.organizationId || workspace.status !== "ACTIVE") {
        throw new Error("TENANT_INVALID_ANCESTRY");
      }
    }
    if (request.brandId) {
      const brand = await this.db.brand.findUnique({ where: { id: request.brandId } });
      if (!brand || brand.organizationId !== request.organizationId || brand.workspaceId !== request.workspaceId || brand.status !== "ACTIVE") {
        throw new Error("TENANT_INVALID_ANCESTRY");
      }
    }
  }

  private async assertExecutionScope(
    run: { organizationId: string; workspaceId: string | null; brandId: string | null },
    workspaceId: string,
    brandId: string | null,
  ): Promise<void> {
    const workspace = await this.db.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace || workspace.organizationId !== run.organizationId || workspace.status !== "ACTIVE") {
      throw new Error("TENANT_INVALID_ANCESTRY");
    }
    if (run.brandId && (brandId !== run.brandId || workspaceId !== run.workspaceId)) {
      throw new Error("TENANT_SCOPE_NOT_CONTAINED");
    }
    if (run.workspaceId && workspaceId !== run.workspaceId) throw new Error("TENANT_SCOPE_NOT_CONTAINED");
    if (brandId) {
      const brand = await this.db.brand.findUnique({ where: { id: brandId } });
      if (!brand || brand.organizationId !== run.organizationId || brand.workspaceId !== workspaceId || brand.status !== "ACTIVE") {
        throw new Error("TENANT_INVALID_ANCESTRY");
      }
    }
  }

  private async activateDueRetries(): Promise<void> {
    const now = this.clock.now();
    const due = await this.db.job.findMany({
      where: {
        status: "RETRY_PENDING", nextAttemptAt: { lte: now }, currentLeaseId: null,
        run: { status: "RETRY_PENDING" },
      },
      select: { id: true, runId: true },
    });
    for (const item of due) {
      await this.db.$transaction(async (tx) => {
        const job = await tx.job.findUnique({ where: { id: item.id } });
        if (!job || job.status !== "RETRY_PENDING" || !job.nextAttemptAt || job.nextAttemptAt > now) return;
        assertJobTransition("RETRY_PENDING", "QUEUED");
        const run = await tx.agentRun.findUniqueOrThrow({ where: { id: item.runId } });
        if (run.status !== "RETRY_PENDING") return;
        assertAgentRunTransition(run.status as AgentRunStatus, "WAITING_FOR_WORKER");
        await tx.job.update({ where: { id: item.id }, data: { status: "QUEUED" } });
        await tx.agentRun.update({ where: { id: item.runId }, data: { status: "WAITING_FOR_WORKER" } });
      });
    }
  }

  private async claimCandidate(jobId: string, workerId: string, leaseDurationMs: number): Promise<ClaimedJob | null> {
    return this.db.$transaction(async (tx) => {
      const job = await tx.job.findUnique({ where: { id: jobId } });
      if (!job || job.status !== "QUEUED" || job.currentLeaseId || job.attemptCount >= job.maxAttempts) return null;
      const worker = await tx.worker.findUnique({ where: { id: workerId }, include: { capabilities: true } });
      if (!worker || worker.status !== "ACTIVE" || worker.protocolVersion !== "1.0") return null;
      const available = new Set(worker.capabilities.map(({ capability }) => capability));
      if (!capabilities(job.requiredCapabilities).every((required) => available.has(required))) return null;
      if (!(await this.hasExactGrant(tx, workerId, job))) return null;
      const now = this.clock.now();
      const attempt = job.attemptCount + 1;
      const leaseId = randomUUID();
      const expiresAt = new Date(now.getTime() + leaseDurationMs);
      await tx.workerLease.create({
        data: { id: leaseId, jobId, workerId, generation: attempt, attemptNumber: attempt, issuedAt: now, expiresAt },
      });
      const updated = await tx.job.updateMany({
        where: { id: jobId, status: "QUEUED", currentLeaseId: null, attemptCount: job.attemptCount },
        data: { status: "CLAIMED", currentLeaseId: leaseId, attemptCount: attempt },
      });
      if (updated.count !== 1) throw new Error("QUEUE_CLAIM_CONFLICT");
      const run = await tx.agentRun.findUniqueOrThrow({ where: { id: job.runId } });
      assertAgentRunTransition(run.status as AgentRunStatus, "CLAIMED");
      await tx.agentRun.update({ where: { id: run.id }, data: { status: "CLAIMED" } });
      await this.audit(tx, job.organizationId, "WORKER", workerId, attempt === 1 ? "WORKER_LEASE_GRANTED" : "WORKER_LEASE_RECLAIMED", "JOB", job.id, run.correlationId, now);
      return { job: { id: job.id, runId: job.runId, attemptCount: attempt }, lease: { id: leaseId, workerId, attemptNumber: attempt, expiresAt } };
    });
  }

  private async requireLeaseAuthority(
    tx: Prisma.TransactionClient,
    jobId: string,
    workerId: string,
    leaseId: string,
  ) {
    const job = await tx.job.findUnique({ where: { id: jobId }, include: { currentLease: true } });
    if (!job || job.currentLeaseId !== leaseId || job.currentLease?.workerId !== workerId) throw new Error("WORKER_STALE_LEASE");
    if (job.currentLease.endedAt || job.currentLease.expiresAt <= this.clock.now()) {
      throw new Error("WORKER_LEASE_EXPIRED");
    }
    const worker = await tx.worker.findUnique({ where: { id: workerId }, include: { capabilities: true } });
    if (!worker || worker.status !== "ACTIVE") throw new Error("WORKER_DISABLED");
    const available = new Set(worker.capabilities.map(({ capability }) => capability));
    if (!capabilities(job.requiredCapabilities).every((required) => available.has(required))) {
      throw new Error("WORKER_CAPABILITY_REQUIRED");
    }
    if (!(await this.hasExactGrant(tx, workerId, job))) throw new Error("WORKER_TENANT_GRANT_REQUIRED");
    return { job, lease: job.currentLease };
  }

  private async hasExactGrant(
    db: Database,
    workerId: string,
    job: { organizationId: string; workspaceId: string; brandId: string | null },
  ): Promise<boolean> {
    if (job.brandId) {
      const grant = await db.workerBrandGrant.findUnique({
        where: { workerId_brandId: { workerId, brandId: job.brandId } },
        include: { organization: true, workspace: true, brand: true },
      });
      return Boolean(grant && grant.status === "ACTIVE" && grant.organizationId === job.organizationId && grant.workspaceId === job.workspaceId && grant.organization.status === "ACTIVE" && grant.workspace.status === "ACTIVE" && grant.brand.status === "ACTIVE");
    }
    const grant = await db.workerWorkspaceGrant.findUnique({
      where: { workerId_workspaceId: { workerId, workspaceId: job.workspaceId } },
      include: { organization: true, workspace: true },
    });
    return Boolean(grant && grant.status === "ACTIVE" && grant.organizationId === job.organizationId && grant.organization.status === "ACTIVE" && grant.workspace.status === "ACTIVE");
  }

  private async audit(
    tx: Prisma.TransactionClient,
    organizationId: string,
    actorType: string,
    actorId: string,
    action: string,
    targetType: string,
    targetId: string,
    correlationId: string,
    occurredAt: Date,
  ): Promise<void> {
    await tx.auditEntry.create({
      data: { id: randomUUID(), organizationId, actorType, actorId, action, targetType, targetId, correlationId, occurredAt },
    });
  }
}
