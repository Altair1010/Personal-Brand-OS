import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { stableHash } from "../../../shared/contracts/stable-json";
import type { ClockPort } from "../../../shared/ports/core-ports";
import type { ApprovalPort, ApprovalRequestCommand, ExternalActor } from "../../../shared/ports/control-plane-ports";
import type { Capability } from "../../identity/domain/rbac";
import { PrismaTenantAccess, type TenantTarget } from "../../identity/infrastructure/prisma-tenant-access";
import { assertAgentRunTransition, assertApprovalTransition, assertJobTransition, type AgentRunStatus, type JobStatus } from "../../agents/domain/state-machines";

type Database = PrismaClient | Prisma.TransactionClient;
type Decision = "APPROVED" | "REJECTED";

const systemClock: ClockPort = { now: () => new Date() };

async function authorizeActor(
  db: Database,
  actor: ExternalActor,
  target: TenantTarget,
  capability: Capability,
): Promise<string> {
  const decision = await new PrismaTenantAccess(db).authorize(actor, target, capability);
  if (!decision.allowed) throw new Error(`PERMISSION_DENIED:${decision.reason}`);
  const identity = await db.authIdentity.findUnique({
    where: { provider_subject: actor }, include: { userIdentity: true },
  });
  if (!identity || identity.userIdentity.status !== "ACTIVE") throw new Error("PERMISSION_DENIED");
  return identity.userIdentityId;
}

async function resolveTarget(db: Database, target: TenantTarget) {
  if (target.type === "ORGANIZATION") {
    const organization = await db.organization.findUnique({ where: { id: target.id } });
    if (!organization) throw new Error("TENANT_INVALID_ANCESTRY");
    return { organizationId: organization.id, workspaceId: null, brandId: null };
  }
  if (target.type === "WORKSPACE") {
    const workspace = await db.workspace.findUnique({ where: { id: target.id } });
    if (!workspace) throw new Error("TENANT_INVALID_ANCESTRY");
    return { organizationId: workspace.organizationId, workspaceId: workspace.id, brandId: null };
  }
  const brand = await db.brand.findUnique({ where: { id: target.id } });
  if (!brand) throw new Error("TENANT_INVALID_ANCESTRY");
  return { organizationId: brand.organizationId, workspaceId: brand.workspaceId, brandId: brand.id };
}

function targetOf(approval: { targetType: string; organizationId: string; workspaceId: string | null; brandId: string | null }): TenantTarget {
  if (approval.targetType === "BRAND" && approval.brandId) return { type: "BRAND", id: approval.brandId };
  if (approval.targetType === "WORKSPACE" && approval.workspaceId) return { type: "WORKSPACE", id: approval.workspaceId };
  if (approval.targetType === "ORGANIZATION") return { type: "ORGANIZATION", id: approval.organizationId };
  throw new Error("TENANT_INVALID_ANCESTRY");
}

export class PrismaApproval implements ApprovalPort {
  constructor(
    private readonly db: PrismaClient,
    private readonly clock: ClockPort = systemClock,
  ) {}

  async request(actor: ExternalActor, input: ApprovalRequestCommand) {
    if (input.expiresAt <= this.clock.now()) throw new Error("APPROVAL_EXPIRED");
    const fingerprint = stableHash(input.payload);
    return this.db.$transaction(async (tx) => {
      const actorId = await authorizeActor(tx, actor, input.target, input.requiredCapability);
      const scope = await resolveTarget(tx, input.target);
      if (input.runId) await this.assertRunContainsTarget(tx, input.runId, scope);
      const existing = await tx.approvalRequest.findUnique({ where: { id: input.id } });
      if (existing) {
        const same = existing.organizationId === scope.organizationId &&
          existing.workspaceId === scope.workspaceId && existing.brandId === scope.brandId &&
          existing.actionType === input.actionType && existing.targetRef === input.targetRef &&
          existing.payloadHash === fingerprint && existing.requiredCapability === input.requiredCapability &&
          existing.requestedByUserIdentityId === actorId && existing.runId === (input.runId ?? null) &&
          existing.expiresAt.getTime() === input.expiresAt.getTime() &&
          existing.oneTimeNonce === (input.oneTimeNonce ?? null);
        if (!same) throw new Error("APPROVAL_REQUEST_CONFLICT");
        return existing;
      }
      const approval = await tx.approvalRequest.create({
        data: {
          id: input.id, organizationId: scope.organizationId, workspaceId: scope.workspaceId,
          brandId: scope.brandId, runId: input.runId ?? null, actionType: input.actionType,
          targetRef: input.targetRef, targetType: input.target.type,
          requiredCapability: input.requiredCapability, payloadHash: fingerprint,
          requestedByUserIdentityId: actorId, expiresAt: input.expiresAt,
          oneTimeNonce: input.oneTimeNonce ?? null,
        },
      });
      if (input.runId) {
        const run = await tx.agentRun.findUniqueOrThrow({ where: { id: input.runId } });
        assertAgentRunTransition(run.status as AgentRunStatus, "WAITING_APPROVAL");
        await tx.agentRun.update({ where: { id: run.id }, data: { status: "WAITING_APPROVAL" } });
      }
      await this.audit(tx, scope.organizationId, actorId, "APPROVAL_REQUESTED", input.id, input.correlationId);
      return approval;
    });
  }

  async decide(actor: ExternalActor, approvalId: string, decision: Decision, payload: unknown) {
    if (await this.expireIfPending(approvalId)) throw new Error("APPROVAL_EXPIRED");
    return this.db.$transaction(async (tx) => {
      let approval = await tx.approvalRequest.findUnique({ where: { id: approvalId } });
      if (!approval) throw new Error("APPROVAL_NOT_FOUND");
      if (approval.payloadHash !== stableHash(payload)) throw new Error("APPROVAL_PAYLOAD_MISMATCH");
      const actorId = await authorizeActor(tx, actor, targetOf(approval), approval.requiredCapability as Capability);
      if (approval.expiresAt <= this.clock.now()) {
        throw new Error("APPROVAL_EXPIRED");
      }
      if (approval.status !== "PENDING") {
        if (approval.status === decision && approval.decidedByUserIdentityId === actorId) return approval;
        throw new Error("APPROVAL_DECISION_CONFLICT");
      }
      assertApprovalTransition("PENDING", decision);
      const now = this.clock.now();
      const changed = await tx.approvalRequest.updateMany({
        where: { id: approval.id, status: "PENDING" },
        data: { status: decision, decidedByUserIdentityId: actorId, decidedAt: now },
      });
      if (changed.count !== 1) throw new Error("APPROVAL_DECISION_CONFLICT");
      await this.audit(tx, approval.organizationId, actorId, `APPROVAL_${decision}`, approval.id, approval.id);
      return tx.approvalRequest.findUniqueOrThrow({ where: { id: approval.id } });
    });
  }

  async consume(actor: ExternalActor, approvalId: string, payload: unknown, oneTimeNonce?: string) {
    if (await this.expireIfPending(approvalId)) throw new Error("APPROVAL_EXPIRED");
    return this.db.$transaction(async (tx) => {
      const approval = await tx.approvalRequest.findUnique({ where: { id: approvalId } });
      if (!approval) throw new Error("APPROVAL_NOT_FOUND");
      if (approval.payloadHash !== stableHash(payload)) throw new Error("APPROVAL_PAYLOAD_MISMATCH");
      const actorId = await authorizeActor(tx, actor, targetOf(approval), approval.requiredCapability as Capability);
      if (approval.expiresAt <= this.clock.now()) throw new Error("APPROVAL_EXPIRED");
      if (approval.status !== "APPROVED") throw new Error("APPROVAL_NOT_APPROVED");
      if (approval.oneTimeNonce && approval.oneTimeNonce !== oneTimeNonce) throw new Error("APPROVAL_NONCE_MISMATCH");
      if (approval.consumedAt) throw new Error("APPROVAL_REPLAY");
      const now = this.clock.now();
      const changed = await tx.approvalRequest.updateMany({
        where: { id: approval.id, status: "APPROVED", consumedAt: null },
        data: { consumedAt: now, consumedByUserIdentityId: actorId },
      });
      if (changed.count !== 1) throw new Error("APPROVAL_REPLAY");
      if (approval.runId) await this.requeueApprovedRun(tx, approval.runId, now);
      await this.audit(tx, approval.organizationId, actorId, "APPROVAL_CONSUMED", approval.id, approval.id);
      return tx.approvalRequest.findUniqueOrThrow({ where: { id: approval.id } });
    });
  }

  async cancel(actor: ExternalActor, approvalId: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const approval = await tx.approvalRequest.findUnique({ where: { id: approvalId } });
      if (!approval) throw new Error("APPROVAL_NOT_FOUND");
      const actorId = await authorizeActor(tx, actor, targetOf(approval), approval.requiredCapability as Capability);
      if (approval.status === "CANCELLED") return;
      if (approval.status !== "PENDING") throw new Error("APPROVAL_DECISION_CONFLICT");
      assertApprovalTransition("PENDING", "CANCELLED");
      const now = this.clock.now();
      await tx.approvalRequest.update({ where: { id: approval.id }, data: { status: "CANCELLED", decidedAt: now } });
      await this.audit(tx, approval.organizationId, actorId, "APPROVAL_CANCELLED", approval.id, approval.id);
    });
  }

  private async assertRunContainsTarget(
    tx: Prisma.TransactionClient,
    runId: string,
    target: { organizationId: string; workspaceId: string | null; brandId: string | null },
  ): Promise<void> {
    const run = await tx.agentRun.findUnique({ where: { id: runId } });
    if (!run || run.organizationId !== target.organizationId) throw new Error("TENANT_SCOPE_NOT_CONTAINED");
    if (run.workspaceId && run.workspaceId !== target.workspaceId) throw new Error("TENANT_SCOPE_NOT_CONTAINED");
    if (run.brandId && run.brandId !== target.brandId) throw new Error("TENANT_SCOPE_NOT_CONTAINED");
  }

  private async expireIfPending(approvalId: string): Promise<boolean> {
    const approval = await this.db.approvalRequest.findUnique({ where: { id: approvalId } });
    if (!approval || approval.expiresAt > this.clock.now()) return false;
    if (approval.status === "PENDING") {
      assertApprovalTransition("PENDING", "EXPIRED");
      await this.db.approvalRequest.updateMany({
        where: { id: approvalId, status: "PENDING" }, data: { status: "EXPIRED" },
      });
    }
    return true;
  }

  private async requeueApprovedRun(tx: Prisma.TransactionClient, runId: string, now: Date): Promise<void> {
    const run = await tx.agentRun.findUniqueOrThrow({ where: { id: runId }, include: { jobs: true } });
    if (run.status !== "WAITING_APPROVAL") return;
    assertAgentRunTransition("WAITING_APPROVAL", "RETRY_PENDING");
    for (const job of run.jobs) {
      if (!["CLAIMED", "RUNNING"].includes(job.status)) continue;
      assertJobTransition(job.status as JobStatus, "RETRY_PENDING");
      if (job.currentLeaseId) {
        await tx.workerLease.update({ where: { id: job.currentLeaseId }, data: { endedAt: now, endReason: "APPROVED_REQUEUE" } });
      }
      await tx.job.update({
        where: { id: job.id }, data: { status: "RETRY_PENDING", nextAttemptAt: now, currentLeaseId: null },
      });
    }
    await tx.agentRun.update({ where: { id: run.id }, data: { status: "RETRY_PENDING" } });
  }

  private async audit(
    tx: Prisma.TransactionClient,
    organizationId: string,
    actorId: string,
    action: string,
    targetId: string,
    correlationId: string,
  ): Promise<void> {
    await tx.auditEntry.create({
      data: {
        id: randomUUID(), organizationId, actorType: "HUMAN", actorId, action,
        targetType: "APPROVAL_REQUEST", targetId, correlationId, occurredAt: this.clock.now(),
      },
    });
  }
}
