import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { WorkerRegistrationSchema, type WorkerRegistration } from "../../../shared/contracts/control-plane";
import { containsObviousSecret } from "../../../shared/contracts/safe-metadata";
import type { ClockPort } from "../../../shared/ports/core-ports";
import type {
  RegisteredWorker,
  ExternalActor,
  WorkerRegistryPort,
  WorkerTenantScope,
} from "../../../shared/ports/control-plane-ports";
import {
  PrismaTenantAccess,
} from "../../identity/infrastructure/prisma-tenant-access";

type Database = PrismaClient | Prisma.TransactionClient;

const systemClock: ClockPort = { now: () => new Date() };

function normalizeCapabilities(capabilities: readonly string[]): string[] {
  return [...new Set(capabilities.map((capability) => capability.trim()))].sort();
}

async function resolveAuthorizedActor(
  db: Database,
  actor: ExternalActor,
  target: WorkerTenantScope,
): Promise<string> {
  const access = new PrismaTenantAccess(db);
  const decision = await access.authorize(actor, target, "agent.manage");
  if (!decision.allowed) throw new Error(`PERMISSION_DENIED:${decision.reason}`);
  const identity = await db.authIdentity.findUnique({
    where: { provider_subject: actor },
    include: { userIdentity: true },
  });
  if (!identity || identity.userIdentity.status !== "ACTIVE") throw new Error("PERMISSION_DENIED");
  return identity.userIdentityId;
}

export class PrismaWorkerRegistry implements WorkerRegistryPort {
  constructor(
    private readonly db: PrismaClient,
    private readonly clock: ClockPort = systemClock,
  ) {}

  async register(input: WorkerRegistration, seenAt = this.clock.now()): Promise<RegisteredWorker> {
    const registration = WorkerRegistrationSchema.parse(input);
    if (containsObviousSecret(registration.repoMappings)) {
      throw new Error("WORKER_SECRET_METADATA_REJECTED");
    }
    const capabilities = normalizeCapabilities(registration.capabilities);
    const existing = await this.db.worker.findUnique({
      where: { id: registration.workerId },
      include: { capabilities: true },
    });
    if (existing) {
      const sameMaterial =
        existing.deviceName === registration.deviceName &&
        existing.os === (registration.os ?? null) &&
        existing.runtimeAdapter === registration.runtime.adapter &&
        existing.runtimeVersion === registration.runtime.version &&
        existing.protocolVersion === (registration.runtime.protocolVersion ?? null) &&
        JSON.stringify(existing.repoMappings) === JSON.stringify(registration.repoMappings ?? null) &&
        JSON.stringify(existing.capabilities.map(({ capability }) => capability).sort()) ===
          JSON.stringify(capabilities);
      if (!sameMaterial) throw new Error("WORKER_REGISTRATION_CONFLICT");
      await this.db.worker.update({ where: { id: existing.id }, data: { lastSeenAt: seenAt } });
      return this.getRequired(existing.id);
    }

    await this.db.worker.create({
      data: {
        id: registration.workerId,
        deviceName: registration.deviceName,
        os: registration.os ?? null,
        runtimeAdapter: registration.runtime.adapter,
        runtimeVersion: registration.runtime.version,
        protocolVersion: registration.runtime.protocolVersion ?? null,
        repoMappings: registration.repoMappings ?? undefined,
        registeredAt: seenAt,
        lastSeenAt: seenAt,
        capabilities: {
          create: capabilities.map((capability) => ({ capability })),
        },
      },
    });
    return this.getRequired(registration.workerId);
  }

  async get(workerId: string): Promise<RegisteredWorker | null> {
    const worker = await this.db.worker.findUnique({
      where: { id: workerId },
      include: { capabilities: { orderBy: { capability: "asc" } } },
    });
    return worker && {
      id: worker.id,
      status: worker.status as RegisteredWorker["status"],
      capabilities: worker.capabilities.map(({ capability }) => capability),
      lastSeenAt: worker.lastSeenAt,
    };
  }

  async heartbeat(workerId: string): Promise<void> {
    const updated = await this.db.worker.updateMany({
      where: { id: workerId },
      data: { lastSeenAt: this.clock.now() },
    });
    if (updated.count !== 1) throw new Error("WORKER_NOT_FOUND");
  }

  async updateCapabilities(workerId: string, input: readonly string[]): Promise<void> {
    const capabilities = normalizeCapabilities(input);
    if (capabilities.some((capability) => capability.length === 0)) {
      throw new Error("WORKER_CAPABILITY_INVALID");
    }
    await this.db.$transaction(async (tx) => {
      const worker = await tx.worker.findUnique({ where: { id: workerId } });
      if (!worker) throw new Error("WORKER_NOT_FOUND");
      await tx.workerCapability.deleteMany({ where: { workerId } });
      await tx.workerCapability.createMany({
        data: capabilities.map((capability) => ({ workerId, capability })),
      });
      await tx.worker.update({
        where: { id: workerId },
        data: { capabilityVersion: { increment: 1 } },
      });
    });
  }

  async disable(workerId: string, actorId: string, correlationId: string): Promise<void> {
    await this.changeWorkerStatus(workerId, "DISABLED", actorId, correlationId);
  }

  async revoke(workerId: string, actorId: string, correlationId: string): Promise<void> {
    await this.changeWorkerStatus(workerId, "REVOKED", actorId, correlationId);
  }

  async isAuthorized(workerId: string, scope: WorkerTenantScope): Promise<boolean> {
    const worker = await this.db.worker.findUnique({ where: { id: workerId } });
    if (!worker || worker.status !== "ACTIVE") return false;
    if (scope.type === "WORKSPACE") {
      const grant = await this.db.workerWorkspaceGrant.findUnique({
        where: { workerId_workspaceId: { workerId, workspaceId: scope.id } },
        include: { organization: true, workspace: true },
      });
      return Boolean(
        grant &&
          grant.status === "ACTIVE" &&
          grant.organization.status === "ACTIVE" &&
          grant.workspace.status === "ACTIVE" &&
          grant.workspace.organizationId === grant.organizationId,
      );
    }
    const grant = await this.db.workerBrandGrant.findUnique({
      where: { workerId_brandId: { workerId, brandId: scope.id } },
      include: { organization: true, workspace: true, brand: true },
    });
    return Boolean(
      grant &&
        grant.status === "ACTIVE" &&
        grant.organization.status === "ACTIVE" &&
        grant.workspace.status === "ACTIVE" &&
        grant.brand.status === "ACTIVE" &&
        grant.workspace.organizationId === grant.organizationId &&
        grant.brand.organizationId === grant.organizationId &&
        grant.brand.workspaceId === grant.workspaceId,
    );
  }

  async grantWorkspace(actor: ExternalActor, workerId: string, workspaceId: string, correlationId: string): Promise<void> {
    await this.changeWorkspaceGrant("GRANT", actor, workerId, workspaceId, correlationId);
  }

  async revokeWorkspace(actor: ExternalActor, workerId: string, workspaceId: string, correlationId: string): Promise<void> {
    await this.changeWorkspaceGrant("REVOKE", actor, workerId, workspaceId, correlationId);
  }

  async grantBrand(actor: ExternalActor, workerId: string, brandId: string, correlationId: string): Promise<void> {
    await this.changeBrandGrant("GRANT", actor, workerId, brandId, correlationId);
  }

  async revokeBrand(actor: ExternalActor, workerId: string, brandId: string, correlationId: string): Promise<void> {
    await this.changeBrandGrant("REVOKE", actor, workerId, brandId, correlationId);
  }

  private async getRequired(workerId: string): Promise<RegisteredWorker> {
    const worker = await this.get(workerId);
    if (!worker) throw new Error("WORKER_NOT_FOUND");
    return worker;
  }

  private async changeWorkerStatus(
    workerId: string,
    status: "DISABLED" | "REVOKED",
    actorId: string,
    correlationId: string,
  ): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const worker = await tx.worker.findUnique({ where: { id: workerId } });
      if (!worker) throw new Error("WORKER_NOT_FOUND");
      if (worker.status === status || worker.status === "REVOKED") return;
      const now = this.clock.now();
      await tx.worker.update({ where: { id: workerId }, data: { status } });
      await tx.auditEntry.create({
        data: {
          id: randomUUID(), organizationId: null, actorType: "SYSTEM", actorId,
          action: status === "DISABLED" ? "WORKER_DISABLED" : "WORKER_REVOKED",
          targetType: "WORKER", targetId: workerId, correlationId, occurredAt: now,
        },
      });
    });
  }

  private async changeWorkspaceGrant(
    operation: "GRANT" | "REVOKE",
    actor: ExternalActor,
    workerId: string,
    workspaceId: string,
    correlationId: string,
  ): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const actorId = await resolveAuthorizedActor(tx, actor, { type: "WORKSPACE", id: workspaceId });
      const [worker, workspace, existing] = await Promise.all([
        tx.worker.findUnique({ where: { id: workerId } }),
        tx.workspace.findUnique({ where: { id: workspaceId } }),
        tx.workerWorkspaceGrant.findUnique({ where: { workerId_workspaceId: { workerId, workspaceId } } }),
      ]);
      if (!worker) throw new Error("WORKER_NOT_FOUND");
      if (!workspace) throw new Error("TENANT_INVALID_ANCESTRY");
      const now = this.clock.now();
      if (operation === "GRANT") {
        if (existing?.status === "ACTIVE") return;
        const action = existing ? "WORKER_WORKSPACE_REGRANTED" : "WORKER_WORKSPACE_GRANTED";
        if (existing) {
          await tx.workerWorkspaceGrant.update({
            where: { id: existing.id },
            data: {
              status: "ACTIVE",
              grantedAt: now,
              grantedByUserIdentityId: actorId,
              revokedAt: null,
              revokedByUserIdentityId: null,
            },
          });
        } else {
          await tx.workerWorkspaceGrant.create({
            data: {
              id: randomUUID(), workerId, organizationId: workspace.organizationId, workspaceId,
              grantedAt: now, grantedByUserIdentityId: actorId,
            },
          });
        }
        await this.appendAudit(tx, workspace.organizationId, actorId, action, "WORKER_WORKSPACE_GRANT", `${workerId}:${workspaceId}`, correlationId, now);
        return;
      }
      if (!existing) throw new Error("WORKER_GRANT_NOT_FOUND");
      if (existing.status === "REVOKED") return;
      await tx.workerWorkspaceGrant.update({
        where: { id: existing.id },
        data: { status: "REVOKED", revokedAt: now, revokedByUserIdentityId: actorId },
      });
      await this.appendAudit(tx, workspace.organizationId, actorId, "WORKER_WORKSPACE_REVOKED", "WORKER_WORKSPACE_GRANT", `${workerId}:${workspaceId}`, correlationId, now);
    });
  }

  private async changeBrandGrant(
    operation: "GRANT" | "REVOKE",
    actor: ExternalActor,
    workerId: string,
    brandId: string,
    correlationId: string,
  ): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const actorId = await resolveAuthorizedActor(tx, actor, { type: "BRAND", id: brandId });
      const [worker, brand, existing] = await Promise.all([
        tx.worker.findUnique({ where: { id: workerId } }),
        tx.brand.findUnique({ where: { id: brandId } }),
        tx.workerBrandGrant.findUnique({ where: { workerId_brandId: { workerId, brandId } } }),
      ]);
      if (!worker) throw new Error("WORKER_NOT_FOUND");
      if (!brand) throw new Error("TENANT_INVALID_ANCESTRY");
      const now = this.clock.now();
      if (operation === "GRANT") {
        if (existing?.status === "ACTIVE") return;
        const action = existing ? "WORKER_BRAND_REGRANTED" : "WORKER_BRAND_GRANTED";
        if (existing) {
          await tx.workerBrandGrant.update({
            where: { id: existing.id },
            data: {
              status: "ACTIVE",
              grantedAt: now,
              grantedByUserIdentityId: actorId,
              revokedAt: null,
              revokedByUserIdentityId: null,
            },
          });
        } else {
          await tx.workerBrandGrant.create({
            data: {
              id: randomUUID(), workerId, organizationId: brand.organizationId,
              workspaceId: brand.workspaceId, brandId, grantedAt: now,
              grantedByUserIdentityId: actorId,
            },
          });
        }
        await this.appendAudit(tx, brand.organizationId, actorId, action, "WORKER_BRAND_GRANT", `${workerId}:${brandId}`, correlationId, now);
        return;
      }
      if (!existing) throw new Error("WORKER_GRANT_NOT_FOUND");
      if (existing.status === "REVOKED") return;
      await tx.workerBrandGrant.update({
        where: { id: existing.id },
        data: { status: "REVOKED", revokedAt: now, revokedByUserIdentityId: actorId },
      });
      await this.appendAudit(tx, brand.organizationId, actorId, "WORKER_BRAND_REVOKED", "WORKER_BRAND_GRANT", `${workerId}:${brandId}`, correlationId, now);
    });
  }

  private async appendAudit(
    tx: Prisma.TransactionClient,
    organizationId: string,
    actorId: string,
    action: string,
    targetType: string,
    targetId: string,
    correlationId: string,
    occurredAt: Date,
  ): Promise<void> {
    await tx.auditEntry.create({
      data: {
        id: randomUUID(), organizationId, actorType: "HUMAN", actorId, action,
        targetType, targetId, correlationId, occurredAt,
      },
    });
  }
}
