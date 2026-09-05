export const ROLES = [
  "OWNER",
  "ADMIN",
  "MANAGER",
  "EDITOR",
  "VIEWER",
  "APPROVER",
  "AGENT_OPERATOR",
] as const;

export type Role = (typeof ROLES)[number];

export const CAPABILITIES = [
  "organization.read",
  "organization.manage",
  "organization.lifecycle.manage",
  "organization.ownership.transfer",
  "rbac.manage",
  "workspace.read",
  "workspace.manage",
  "workspace.lifecycle.manage",
  "brand.read",
  "brand.manage",
  "brand.lifecycle.manage",
  "content.read",
  "content.write",
  "content.approve",
  "content.publish",
  "work.read",
  "work.manage",
  "agent.run",
  "agent.manage",
  "integration.read",
  "integration.manage",
  "metrics.read",
  "learning.manage",
  "audit.read",
] as const;

export type Capability = (typeof CAPABILITIES)[number];
export type ScopeType = "ORGANIZATION" | "WORKSPACE" | "BRAND";
export type ActiveStatus = "ACTIVE" | "DISABLED";
export type MembershipStatus = "ACTIVE" | "SUSPENDED" | "REVOKED";
export type TenantStatus = "ACTIVE" | "ARCHIVED";

const ALLOWED_CAPABILITIES: Record<Role, readonly Capability[]> = {
  OWNER: CAPABILITIES,
  ADMIN: CAPABILITIES.filter(
    (capability) =>
      capability !== "organization.lifecycle.manage" &&
      capability !== "organization.ownership.transfer",
  ),
  MANAGER: [
    "organization.read",
    "workspace.read",
    "brand.read",
    "brand.manage",
    "content.read",
    "content.write",
    "content.approve",
    "content.publish",
    "work.read",
    "work.manage",
    "agent.run",
    "integration.read",
    "metrics.read",
    "learning.manage",
  ],
  EDITOR: [
    "organization.read",
    "workspace.read",
    "brand.read",
    "content.read",
    "content.write",
    "work.read",
    "metrics.read",
  ],
  VIEWER: [
    "organization.read",
    "workspace.read",
    "brand.read",
    "content.read",
    "work.read",
    "metrics.read",
  ],
  APPROVER: [
    "organization.read",
    "workspace.read",
    "brand.read",
    "content.read",
    "content.approve",
    "work.read",
    "metrics.read",
  ],
  AGENT_OPERATOR: [
    "organization.read",
    "workspace.read",
    "brand.read",
    "content.read",
    "work.read",
    "agent.run",
    "metrics.read",
  ],
};

export const ROLE_CAPABILITIES = Object.freeze(
  Object.fromEntries(
    ROLES.map((role) => [
      role,
      Object.freeze(
        Object.fromEntries(
          CAPABILITIES.map((capability) => [
            capability,
            ALLOWED_CAPABILITIES[role].includes(capability),
          ]),
        ) as Record<Capability, boolean>,
      ),
    ]),
  ) as Record<Role, Readonly<Record<Capability, boolean>>>,
);

const SCOPE_APPLICABILITY: Readonly<Record<Capability, readonly ScopeType[]>> = {
  "organization.read": ["ORGANIZATION"],
  "organization.manage": ["ORGANIZATION"],
  "organization.lifecycle.manage": ["ORGANIZATION"],
  "organization.ownership.transfer": ["ORGANIZATION"],
  "rbac.manage": ["ORGANIZATION", "WORKSPACE", "BRAND"],
  "workspace.read": ["WORKSPACE"],
  "workspace.manage": ["WORKSPACE"],
  "workspace.lifecycle.manage": ["WORKSPACE"],
  "brand.read": ["BRAND"],
  "brand.manage": ["BRAND"],
  "brand.lifecycle.manage": ["BRAND"],
  "content.read": ["BRAND"],
  "content.write": ["BRAND"],
  "content.approve": ["BRAND"],
  "content.publish": ["BRAND"],
  "work.read": ["WORKSPACE", "BRAND"],
  "work.manage": ["WORKSPACE", "BRAND"],
  "agent.run": ["WORKSPACE", "BRAND"],
  "agent.manage": ["WORKSPACE", "BRAND"],
  "integration.read": ["BRAND"],
  "integration.manage": ["BRAND"],
  "metrics.read": ["BRAND"],
  "learning.manage": ["BRAND"],
  "audit.read": ["ORGANIZATION"],
};

export type AuthorizationReason =
  | "ALLOWED"
  | "UNKNOWN_CAPABILITY"
  | "UNKNOWN_ROLE"
  | "INACTIVE_PRINCIPAL"
  | "INVALID_TARGET"
  | "INVALID_ANCESTRY"
  | "ARCHIVED_SCOPE"
  | "NO_GRANT";

export interface AuthorizationInput {
  readonly identityStatus: ActiveStatus;
  readonly membershipStatus: MembershipStatus;
  readonly organizationRole?: Role | null;
  readonly workspaceRole?: Role | null;
  readonly brandRole?: Role | null;
  readonly capability: Capability;
  readonly target: {
    readonly type: ScopeType;
    readonly organizationStatus?: TenantStatus;
    readonly workspaceStatus?: TenantStatus;
    readonly brandStatus?: TenantStatus;
  };
}

export interface AuthorizationDecision {
  readonly allowed: boolean;
  readonly reason: AuthorizationReason;
}

function deny(reason: Exclude<AuthorizationReason, "ALLOWED">): AuthorizationDecision {
  return { allowed: false, reason };
}

function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLES.includes(value as Role);
}

function isCapability(value: unknown): value is Capability {
  return typeof value === "string" && CAPABILITIES.includes(value as Capability);
}

function ancestryIsComplete(input: AuthorizationInput): boolean {
  if (!input.target.organizationStatus) return false;
  if (input.target.type !== "ORGANIZATION" && !input.target.workspaceStatus) return false;
  if (input.target.type === "BRAND" && !input.target.brandStatus) return false;
  return true;
}

function archivedScopeAllows(input: AuthorizationInput): boolean {
  const readCapability = input.capability.endsWith(".read");
  if (readCapability) return true;

  if (input.target.type === "ORGANIZATION") {
    return input.capability === "organization.lifecycle.manage";
  }
  if (input.target.organizationStatus !== "ACTIVE") return false;
  if (input.target.type === "WORKSPACE") {
    return input.capability === "workspace.lifecycle.manage";
  }
  if (input.target.workspaceStatus !== "ACTIVE") return false;
  return input.capability === "brand.lifecycle.manage";
}

export function evaluateAuthorization(input: AuthorizationInput): AuthorizationDecision {
  if (!isCapability(input.capability)) return deny("UNKNOWN_CAPABILITY");
  if (!SCOPE_APPLICABILITY[input.capability].includes(input.target.type)) {
    return deny("INVALID_TARGET");
  }
  if (input.identityStatus !== "ACTIVE" || input.membershipStatus !== "ACTIVE") {
    return deny("INACTIVE_PRINCIPAL");
  }
  if (!ancestryIsComplete(input)) return deny("INVALID_ANCESTRY");

  const candidateRoles = [input.organizationRole];
  if (input.target.type !== "ORGANIZATION") candidateRoles.push(input.workspaceRole);
  if (input.target.type === "BRAND") candidateRoles.push(input.brandRole);
  if (candidateRoles.some((role) => role != null && !isRole(role))) return deny("UNKNOWN_ROLE");

  const isArchived =
    input.target.organizationStatus === "ARCHIVED" ||
    input.target.workspaceStatus === "ARCHIVED" ||
    input.target.brandStatus === "ARCHIVED";
  if (isArchived && !archivedScopeAllows(input)) return deny("ARCHIVED_SCOPE");

  const allowed = candidateRoles
    .filter(isRole)
    .some((role) => ROLE_CAPABILITIES[role][input.capability]);
  return allowed ? { allowed: true, reason: "ALLOWED" } : deny("NO_GRANT");
}
