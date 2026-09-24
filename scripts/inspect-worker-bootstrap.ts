import { db } from "../lib/db";

async function main() {
  const worker = await db.worker.findUnique({
    where: { id: "worker-openclaw-local" },
    include: {
      workspaceGrants: true,
      brandGrants: true,
      credentials: {
        select: {
          id: true,
          workerId: true,
          issuedAt: true,
          expiresAt: true,
          familyExpiresAt: true,
          revokedAt: true,
          supersededByCredentialId: true,
        },
        orderBy: { issuedAt: "desc" },
      },
    },
  });
  const actors = await db.authIdentity.findMany({
    include: { userIdentity: { include: { memberships: true } } },
  });
  console.log(JSON.stringify({
    worker,
    actors: actors.map((x) => ({
      provider: x.provider,
      subject: x.subject,
      userIdentityId: x.userIdentityId,
      status: x.userIdentity.status,
      memberships: x.userIdentity.memberships.map((m) => ({
        org: m.organizationId,
        role: m.organizationRole,
        status: m.status,
      })),
    })),
  }, null, 2));
}

main().finally(() => db.$disconnect());
