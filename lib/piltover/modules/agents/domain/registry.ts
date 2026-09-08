import { z } from "zod";

const nonBlank = z.string().trim().min(1).max(4_000);
const identifier = z.string().trim().min(1).max(191);

export const AgentDefinitionSpecV1Schema = z.object({
  objective: nonBlank,
  instructions: z.array(nonBlank).max(64),
}).strict();

export const AgentRoleSpecV1Schema = z.object({
  operatingConstraints: z.array(nonBlank).min(1).max(64),
}).strict();

export type AgentDefinitionSpecV1 = z.infer<typeof AgentDefinitionSpecV1Schema>;
export type AgentRoleSpecV1 = z.infer<typeof AgentRoleSpecV1Schema>;

export const ArtifactOwnerScopeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("PLATFORM") }).strict(),
  z.object({ type: z.literal("ORGANIZATION"), organizationId: identifier }).strict(),
  z.object({
    type: z.literal("WORKSPACE"),
    organizationId: identifier,
    workspaceId: identifier,
  }).strict(),
  z.object({
    type: z.literal("BRAND"),
    organizationId: identifier,
    workspaceId: identifier,
    brandId: identifier,
  }).strict(),
]);

export type ArtifactOwnerScope = z.infer<typeof ArtifactOwnerScopeSchema>;
export type TenantArtifactOwnerScope = Exclude<ArtifactOwnerScope, { readonly type: "PLATFORM" }>;

export const ArtifactTargetScopeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ORGANIZATION"), organizationId: identifier }).strict(),
  z.object({
    type: z.literal("WORKSPACE"),
    organizationId: identifier,
    workspaceId: identifier,
  }).strict(),
  z.object({
    type: z.literal("BRAND"),
    organizationId: identifier,
    workspaceId: identifier,
    brandId: identifier,
  }).strict(),
]);

export type ArtifactTargetScope = z.infer<typeof ArtifactTargetScopeSchema>;
export type AgentParentStatus = "ACTIVE" | "SUSPENDED" | "ARCHIVED";
export type AgentVersionStatus = "DRAFT" | "PUBLISHED" | "RETIRED";

export function isArtifactApplicableToScope(
  ownerInput: ArtifactOwnerScope,
  targetInput: ArtifactTargetScope,
): boolean {
  const owner = ArtifactOwnerScopeSchema.parse(ownerInput);
  const target = ArtifactTargetScopeSchema.parse(targetInput);
  if (owner.type === "PLATFORM") return true;
  if (owner.organizationId !== target.organizationId) return false;
  if (owner.type === "ORGANIZATION") return true;
  if (target.type === "ORGANIZATION" || owner.workspaceId !== target.workspaceId) return false;
  if (owner.type === "WORKSPACE") return true;
  return target.type === "BRAND" && owner.brandId === target.brandId;
}
