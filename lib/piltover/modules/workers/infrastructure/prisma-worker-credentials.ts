import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { ClockPort } from "../../../shared/ports/core-ports";
import type { ExternalActor, WorkerTenantScope } from "../../../shared/ports/control-plane-ports";
import type { AuthenticatedWorkerPrincipal, IssuedWorkerCredential, WorkerCredentialPort } from "../../../shared/ports/worker-bridge-ports";
import { WorkerCredentialFormat } from "../../../shared/contracts/worker-bridge";
import { PrismaTenantAccess } from "../../identity/infrastructure/prisma-tenant-access";

type Database = PrismaClient | Prisma.TransactionClient;
const systemClock: ClockPort = { now: () => new Date() };
const MAX_LIFETIME_MS = 90 * 24 * 60 * 60 * 1_000;
const MAX_OVERLAP_MS = 10 * 60 * 1_000;

function verifier(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

async function resolveActor(db: Database, actor: ExternalActor, target: WorkerTenantScope): Promise<string> {
  const decision = await new PrismaTenantAccess(db).authorize(actor, target, "agent.manage");
  if (!decision.allowed) throw new Error(`PERMISSION_DENIED:${decision.reason}`);
  const identity = await db.authIdentity.findUnique({ where: { provider_subject: actor }, include: { userIdentity: true } });
  if (!identity || identity.userIdentity.status !== "ACTIVE") throw new Error("PERMISSION_DENIED");
  return identity.userIdentityId;
}

async function assertWorkerTarget(db: Database, workerId: string, target: WorkerTenantScope, requireActive: boolean): Promise<void> {
  const worker = await db.worker.findUnique({ where: { id: workerId } });
  if (!worker) throw new Error("WORKER_NOT_FOUND");
  if (requireActive && worker.status !== "ACTIVE") throw new Error("WORKER_DISABLED");
  if (target.type === "WORKSPACE") {
    const grant = await db.workerWorkspaceGrant.findUnique({
      where: { workerId_workspaceId: { workerId, workspaceId: target.id } },
      include: { organization: true, workspace: true },
    });
    if (!grant || (requireActive && grant.status !== "ACTIVE") || grant.organization.status !== "ACTIVE" ||
      grant.workspace.status !== "ACTIVE" || grant.workspace.organizationId !== grant.organizationId) {
      throw new Error("WORKER_TENANT_GRANT_REQUIRED");
    }
    return;
  }
  const grant = await db.workerBrandGrant.findUnique({
    where: { workerId_brandId: { workerId, brandId: target.id } },
    include: { organization: true, workspace: true, brand: true },
  });
  if (!grant || (requireActive && grant.status !== "ACTIVE") || grant.organization.status !== "ACTIVE" ||
    grant.workspace.status !== "ACTIVE" || grant.brand.status !== "ACTIVE" ||
    grant.workspace.organizationId !== grant.organizationId || grant.brand.organizationId !== grant.organizationId ||
    grant.brand.workspaceId !== grant.workspaceId) throw new Error("WORKER_TENANT_GRANT_REQUIRED");
}

function validateLifetime(value: number): void {
  if (!Number.isInteger(value) || value <= 0 || value > MAX_LIFETIME_MS) throw new Error("AUTH_CREDENTIAL_LIFETIME_INVALID");
}

function mint(): { id: string; secret: string; credential: string; secretVerifier: string } {
  const id = randomUUID().replaceAll("-", "");
  const secret = randomBytes(32).toString("base64url");
  return { id, secret, credential: `${id}.${secret}`, secretVerifier: verifier(secret).toString("hex") };
}

export class PrismaWorkerCredentialStore implements WorkerCredentialPort {
  constructor(private readonly db: PrismaClient, private readonly clock: ClockPort = systemClock) {}

  async issue(actor: ExternalActor, workerId: string, target: WorkerTenantScope, lifetimeMs: number, correlationId: string): Promise<IssuedWorkerCredential> {
    validateLifetime(lifetimeMs);
    const material = mint();
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + lifetimeMs);
    await this.db.$transaction(async (tx) => {
      const actorId = await resolveActor(tx, actor, target);
      await assertWorkerTarget(tx, workerId, target, true);
      await tx.workerCredential.create({ data: {
        id: material.id, workerId, secretVerifier: material.secretVerifier, issuedAt: now, expiresAt,
        createdByUserIdentityId: actorId,
      } });
      await tx.auditEntry.create({ data: {
        id: randomUUID(), organizationId: null, actorType: "USER", actorId,
        action: "WORKER_CREDENTIAL_ISSUED", targetType: "WORKER_CREDENTIAL", targetId: material.id,
        correlationId, metadata: { workerId }, occurredAt: now,
      } });
    });
    return { workerId, credentialId: material.id, credential: material.credential, expiresAt };
  }

  async authenticate(credential: string): Promise<AuthenticatedWorkerPrincipal> {
    const match = WorkerCredentialFormat.exec(credential);
    if (!match) throw new Error("AUTH_INVALID_CREDENTIAL");
    const record = await this.db.workerCredential.findUnique({ where: { id: match[1] } });
    if (!record) throw new Error("AUTH_INVALID_CREDENTIAL");
    const expected = Buffer.from(record.secretVerifier, "hex");
    const actual = verifier(match[2]);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error("AUTH_INVALID_CREDENTIAL");
    if (record.revokedAt) throw new Error("AUTH_CREDENTIAL_REVOKED");
    if (record.expiresAt.getTime() <= this.clock.now().getTime()) throw new Error("AUTH_CREDENTIAL_EXPIRED");
    return { workerId: record.workerId, credentialId: record.id };
  }

  async rotate(credential: string, overlapMs: number, lifetimeMs: number, correlationId: string): Promise<IssuedWorkerCredential> {
    validateLifetime(lifetimeMs);
    if (!Number.isInteger(overlapMs) || overlapMs < 0 || overlapMs > MAX_OVERLAP_MS) throw new Error("AUTH_ROTATION_OVERLAP_INVALID");
    const principal = await this.authenticate(credential);
    const material = mint();
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + lifetimeMs);
    await this.db.$transaction(async (tx) => {
      const current = await tx.workerCredential.findUniqueOrThrow({ where: { id: principal.credentialId } });
      if (current.supersededByCredentialId) throw new Error("AUTH_CREDENTIAL_ALREADY_ROTATED");
      if (current.revokedAt) throw new Error("AUTH_CREDENTIAL_REVOKED");
      if (current.expiresAt.getTime() <= now.getTime()) throw new Error("AUTH_CREDENTIAL_EXPIRED");
      const worker = await tx.worker.findUniqueOrThrow({ where: { id: principal.workerId } });
      if (worker.status !== "ACTIVE") throw new Error("WORKER_DISABLED");
      await tx.workerCredential.create({ data: {
        id: material.id, workerId: principal.workerId, secretVerifier: material.secretVerifier, issuedAt: now, expiresAt,
      } });
      const overlapEnd = new Date(Math.min(current.expiresAt.getTime(), now.getTime() + overlapMs));
      const updated = await tx.workerCredential.updateMany({
        where: { id: current.id, supersededByCredentialId: null, revokedAt: null, expiresAt: { gt: now } },
        data: { supersededByCredentialId: material.id, rotationStartedAt: now, expiresAt: overlapEnd },
      });
      if (updated.count !== 1) throw new Error("AUTH_CREDENTIAL_ALREADY_ROTATED");
      await tx.auditEntry.create({ data: {
        id: randomUUID(), organizationId: null, actorType: "WORKER", actorId: principal.workerId,
        action: "WORKER_CREDENTIAL_ROTATED", targetType: "WORKER_CREDENTIAL", targetId: current.id,
        correlationId, metadata: { workerId: principal.workerId, replacementCredentialId: material.id }, occurredAt: now,
      } });
    });
    return { workerId: principal.workerId, credentialId: material.id, credential: material.credential, expiresAt };
  }

  async revoke(actor: ExternalActor, credentialId: string, target: WorkerTenantScope, correlationId: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const record = await tx.workerCredential.findUnique({ where: { id: credentialId } });
      if (!record) throw new Error("AUTH_CREDENTIAL_NOT_FOUND");
      const actorId = await resolveActor(tx, actor, target);
      await assertWorkerTarget(tx, record.workerId, target, false);
      if (record.revokedAt) return;
      const now = this.clock.now();
      await tx.workerCredential.update({ where: { id: credentialId }, data: { revokedAt: now, revokedByUserIdentityId: actorId } });
      await tx.auditEntry.create({ data: {
        id: randomUUID(), organizationId: null, actorType: "USER", actorId,
        action: "WORKER_CREDENTIAL_REVOKED", targetType: "WORKER_CREDENTIAL", targetId: credentialId,
        correlationId, metadata: { workerId: record.workerId }, occurredAt: now,
      } });
    });
  }
}
