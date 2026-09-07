import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
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

async function resolveActor(db: Database, actor: ExternalActor): Promise<string> {
  const identity = await db.authIdentity.findUnique({ where: { provider_subject: actor }, include: { userIdentity: true } });
  if (!identity || identity.userIdentity.status !== "ACTIVE") throw new Error("PERMISSION_DENIED");
  return identity.userIdentityId;
}

async function assertActorMayGovernWorkerIdentity(
  db: Database,
  actor: ExternalActor,
  workerId: string,
): Promise<string> {
  const worker = await db.worker.findUnique({ where: { id: workerId } });
  if (!worker) throw new Error("WORKER_NOT_FOUND");
  if (worker.status !== "ACTIVE") throw new Error("WORKER_DISABLED");

  const [workspaceGrants, brandGrants] = await Promise.all([
    db.workerWorkspaceGrant.findMany({
      where: { workerId, status: "ACTIVE" },
      select: { workspaceId: true },
      orderBy: { workspaceId: "asc" },
    }),
    db.workerBrandGrant.findMany({
      where: { workerId, status: "ACTIVE" },
      select: { brandId: true },
      orderBy: { brandId: "asc" },
    }),
  ]);
  if (workspaceGrants.length === 0 && brandGrants.length === 0) {
    throw new Error("WORKER_ACTIVE_GRANT_REQUIRED");
  }

  const access = new PrismaTenantAccess(db);
  for (const grant of workspaceGrants) {
    const decision = await access.authorize(actor, { type: "WORKSPACE", id: grant.workspaceId }, "agent.manage");
    if (!decision.allowed) throw new Error(`PERMISSION_DENIED:${decision.reason}`);
  }
  for (const grant of brandGrants) {
    const decision = await access.authorize(actor, { type: "BRAND", id: grant.brandId }, "agent.manage");
    if (!decision.allowed) throw new Error(`PERMISSION_DENIED:${decision.reason}`);
  }
  return resolveActor(db, actor);
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

  async issue(actor: ExternalActor, workerId: string, _target: WorkerTenantScope, lifetimeMs: number, correlationId: string): Promise<IssuedWorkerCredential> {
    validateLifetime(lifetimeMs);
    const material = mint();
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + lifetimeMs);
    await this.db.$transaction(async (tx) => {
      const actorId = await assertActorMayGovernWorkerIdentity(tx, actor, workerId);
      await tx.workerCredential.create({ data: {
        id: material.id, workerId, secretVerifier: material.secretVerifier, issuedAt: now, expiresAt,
        familyExpiresAt: expiresAt,
        createdByUserIdentityId: actorId,
      } });
      await tx.auditEntry.create({ data: {
        id: randomUUID(), organizationId: null, actorType: "USER", actorId,
        action: "WORKER_CREDENTIAL_ISSUED", targetType: "WORKER_CREDENTIAL", targetId: material.id,
        correlationId, metadata: { workerId }, occurredAt: now,
      } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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
    const now = this.clock.now().getTime();
    if (record.expiresAt.getTime() <= now || record.familyExpiresAt.getTime() <= now) {
      throw new Error("AUTH_CREDENTIAL_EXPIRED");
    }
    return { workerId: record.workerId, credentialId: record.id };
  }

  async rotate(credential: string, overlapMs: number, lifetimeMs: number, correlationId: string): Promise<IssuedWorkerCredential> {
    validateLifetime(lifetimeMs);
    if (!Number.isInteger(overlapMs) || overlapMs < 0 || overlapMs > MAX_OVERLAP_MS) throw new Error("AUTH_ROTATION_OVERLAP_INVALID");
    const principal = await this.authenticate(credential);
    const material = mint();
    const now = this.clock.now();
    const expiresAt = await this.db.$transaction(async (tx) => {
      const current = await tx.workerCredential.findUniqueOrThrow({ where: { id: principal.credentialId } });
      if (current.supersededByCredentialId) throw new Error("AUTH_CREDENTIAL_ALREADY_ROTATED");
      if (current.revokedAt) throw new Error("AUTH_CREDENTIAL_REVOKED");
      if (current.expiresAt.getTime() <= now.getTime()) throw new Error("AUTH_CREDENTIAL_EXPIRED");
      if (current.familyExpiresAt.getTime() <= now.getTime()) throw new Error("AUTH_CREDENTIAL_EXPIRED");
      const worker = await tx.worker.findUniqueOrThrow({ where: { id: principal.workerId } });
      if (worker.status !== "ACTIVE") throw new Error("WORKER_DISABLED");
      const replacementExpiresAt = new Date(Math.min(current.familyExpiresAt.getTime(), now.getTime() + lifetimeMs));
      await tx.workerCredential.create({ data: {
        id: material.id, workerId: principal.workerId, secretVerifier: material.secretVerifier, issuedAt: now,
        expiresAt: replacementExpiresAt, familyExpiresAt: current.familyExpiresAt,
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
      return replacementExpiresAt;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { workerId: principal.workerId, credentialId: material.id, credential: material.credential, expiresAt };
  }

  async revoke(actor: ExternalActor, credentialId: string, _target: WorkerTenantScope, correlationId: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const record = await tx.workerCredential.findUnique({ where: { id: credentialId } });
      if (!record) throw new Error("AUTH_CREDENTIAL_NOT_FOUND");
      const actorId = await assertActorMayGovernWorkerIdentity(tx, actor, record.workerId);
      if (record.revokedAt) return;
      const now = this.clock.now();
      await tx.workerCredential.update({ where: { id: credentialId }, data: { revokedAt: now, revokedByUserIdentityId: actorId } });
      await tx.auditEntry.create({ data: {
        id: randomUUID(), organizationId: null, actorType: "USER", actorId,
        action: "WORKER_CREDENTIAL_REVOKED", targetType: "WORKER_CREDENTIAL", targetId: credentialId,
        correlationId, metadata: { workerId: record.workerId }, occurredAt: now,
      } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
