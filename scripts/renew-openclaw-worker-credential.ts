import fs from "node:fs/promises";
import path from "node:path";
import { db } from "../lib/db";
import { PrismaWorkerCredentialStore } from "../lib/piltover/modules/workers/infrastructure/prisma-worker-credentials";

const WORKER_ID = process.env.PILTOVER_WORKER_ID ?? "worker-openclaw-local";
const LIFETIME_DAYS = Math.min(90, Math.max(1, Number(process.env.PILTOVER_WORKER_CREDENTIAL_DAYS ?? "90")));
const LIFETIME_MS = LIFETIME_DAYS * 24 * 60 * 60 * 1000;

function credentialPath() {
  const local = process.env.LOCALAPPDATA;
  if (!local) throw new Error("LOCALAPPDATA is unavailable.");
  return path.join(local, "Piltover", "credentials", `${WORKER_ID}.credential`);
}

async function main() {
  const worker = await db.worker.findUnique({
    where: { id: WORKER_ID },
    include: {
      workspaceGrants: { where: { status: "ACTIVE" }, orderBy: { grantedAt: "asc" } },
      brandGrants: { where: { status: "ACTIVE" }, orderBy: { grantedAt: "asc" } },
    },
  });
  if (!worker || worker.status !== "ACTIVE") throw new Error("WORKER_NOT_ACTIVE");

  const grant = worker.workspaceGrants[0] ?? worker.brandGrants[0];
  if (!grant) throw new Error("WORKER_ACTIVE_GRANT_REQUIRED");

  const grantorId = grant.grantedByUserIdentityId;
  const identity = await db.authIdentity.findFirst({
    where: { userIdentityId: grantorId },
    orderBy: { createdAt: "asc" },
  });
  if (!identity) throw new Error("WORKER_GRANTOR_AUTH_IDENTITY_NOT_FOUND");

  const actor = { provider: identity.provider, subject: identity.subject } as const;
  const target = worker.workspaceGrants[0]
    ? { type: "WORKSPACE" as const, id: worker.workspaceGrants[0].workspaceId }
    : { type: "BRAND" as const, id: worker.brandGrants[0].brandId };

  const store = new PrismaWorkerCredentialStore(db);
  const issued = await store.issue(
    actor,
    WORKER_ID,
    target,
    LIFETIME_MS,
    `local-reenroll:${WORKER_ID}:${Date.now()}`,
  );

  const file = credentialPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, issued.credential, { encoding: "utf8", mode: 0o600 });

  console.log(JSON.stringify({
    ok: true,
    workerId: WORKER_ID,
    credentialId: issued.credentialId,
    expiresAt: issued.expiresAt.toISOString(),
    credentialPath: file,
  }, null, 2));
}

main().finally(() => db.$disconnect());
