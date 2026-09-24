import type { PrismaClient } from "@prisma/client";

export type ToolDecision =
  | { allowed: false; reason: "NO_GRANT" | "WRITE_DENIED" | "SCOPE_DENIED" }
  | { allowed: false; reason: "APPROVAL_REQUIRED"; grantId: string }
  | { allowed: true; grantId: string };

export async function authorizeToolAction(
  db: PrismaClient,
  input: {
    organizationId: string;
    workspaceId?: string | null;
    brandId?: string | null;
    agentDefinitionId?: string | null;
    toolNamespace: string;
    action: string;
    mode: "read" | "write";
  },
): Promise<ToolDecision> {
  const grants = await db.toolGrant.findMany({
    where: {
      organizationId: input.organizationId,
      toolNamespace: input.toolNamespace,
      action: input.action,
      status: "ACTIVE",
      OR: [
        { agentDefinitionId: input.agentDefinitionId ?? null },
        { agentDefinitionId: null },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  const grant = grants.find((candidate) => {
    if (candidate.workspaceId && candidate.workspaceId !== input.workspaceId) return false;
    if (candidate.brandId && candidate.brandId !== input.brandId) return false;
    const scope = candidate.resourceScope;
    if (!scope || typeof scope !== "object" || Array.isArray(scope)) return true;
    const rec = scope as Record<string, unknown>;
    const workspaceIds = Array.isArray(rec.workspaceIds) ? rec.workspaceIds : [];
    const brandIds = Array.isArray(rec.brandIds) ? rec.brandIds : [];
    if (workspaceIds.length && !workspaceIds.includes(input.workspaceId)) return false;
    if (brandIds.length && !brandIds.includes(input.brandId)) return false;
    return true;
  });

  if (!grant) return { allowed: false, reason: "NO_GRANT" };
  if (input.mode === "write" && !grant.canWrite) {
    return { allowed: false, reason: "WRITE_DENIED" };
  }
  if (input.mode === "read" && !grant.canRead) {
    return { allowed: false, reason: "SCOPE_DENIED" };
  }
  if (grant.approvalRequired) {
    return { allowed: false, reason: "APPROVAL_REQUIRED", grantId: grant.id };
  }
  return { allowed: true, grantId: grant.id };
}
