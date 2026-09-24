import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { authorizeToolAction } from "@/lib/piltover/vnext/tool-policy";

const json = (value: unknown) => value as Prisma.InputJsonValue;

export async function evaluateToolGrant(db: PrismaClient, input: {
  organizationId: string; workspaceId?: string | null; brandId?: string | null;
  agentDefinitionId?: string | null; namespace: string; action: string; write?: boolean;
}) {
  const decision = await authorizeToolAction(db, {
    organizationId: input.organizationId,
    workspaceId: input.workspaceId ?? null,
    brandId: input.brandId ?? null,
    agentDefinitionId: input.agentDefinitionId ?? null,
    toolNamespace: input.namespace,
    action: input.action,
    mode: input.write ? "write" : "read",
  });
  if (decision.allowed) {
    const grant = await db.toolGrant.findUnique({ where: { id: decision.grantId } });
    if (!grant) return { allowed: false, approvalRequired: false, reason: "TOOL_GRANT_MISSING" } as const;
    return { allowed: true, approvalRequired: false, grant } as const;
  }
  if (decision.reason === "APPROVAL_REQUIRED") {
    const grant = await db.toolGrant.findUnique({ where: { id: decision.grantId } });
    if (!grant) return { allowed: false, approvalRequired: false, reason: "TOOL_GRANT_MISSING" } as const;
    return { allowed: true, approvalRequired: true, grant } as const;
  }
  const reason =
    decision.reason === "NO_GRANT" ? "TOOL_GRANT_MISSING"
      : decision.reason === "WRITE_DENIED" ? "TOOL_WRITE_DENIED"
        : "TOOL_READ_DENIED";
  return { allowed: false, approvalRequired: false, reason } as const;
}

export async function requestToolApproval(db: PrismaClient, input: {
  organizationId: string; workspaceId?: string | null; brandId?: string | null; runId?: string | null;
  actionType: string; targetRef: string; targetType: string; requiredCapability: string;
  payloadHash: string; payloadSnapshot?: unknown; requestedByUserIdentityId: string; expiresInMs?: number;
}) {
  const now = new Date();
  return db.approvalRequest.create({
    data: {
      id: randomUUID(), organizationId: input.organizationId, workspaceId: input.workspaceId ?? null,
      brandId: input.brandId ?? null, runId: input.runId ?? null, actionType: input.actionType,
      targetRef: input.targetRef, targetType: input.targetType, requiredCapability: input.requiredCapability,
      payloadHash: input.payloadHash, payloadSnapshot: input.payloadSnapshot === undefined ? undefined : json(input.payloadSnapshot),
      status: "PENDING", requestedByUserIdentityId: input.requestedByUserIdentityId,
      expiresAt: new Date(now.getTime() + (input.expiresInMs ?? 30 * 60_000)),
    },
  });
}
