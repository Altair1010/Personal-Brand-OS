import { describe, expect, it } from "vitest";
import {
  CAPABILITIES,
  ROLES,
  ROLE_CAPABILITIES,
  evaluateAuthorization,
  type AuthorizationInput,
  type Capability,
  type Role,
} from "@/lib/piltover/modules/identity/domain/rbac";

const EXPECTED_ALLOWED_ROLES: Record<Capability, readonly Role[]> = {
  "organization.read": ROLES,
  "organization.manage": ["OWNER", "ADMIN"],
  "organization.lifecycle.manage": ["OWNER"],
  "organization.ownership.transfer": ["OWNER"],
  "rbac.manage": ["OWNER", "ADMIN"],
  "workspace.read": ROLES,
  "workspace.manage": ["OWNER", "ADMIN"],
  "workspace.lifecycle.manage": ["OWNER", "ADMIN"],
  "brand.read": ROLES,
  "brand.manage": ["OWNER", "ADMIN", "MANAGER"],
  "brand.lifecycle.manage": ["OWNER", "ADMIN"],
  "content.read": ROLES,
  "content.write": ["OWNER", "ADMIN", "MANAGER", "EDITOR"],
  "content.approve": ["OWNER", "ADMIN", "MANAGER", "APPROVER"],
  "content.publish": ["OWNER", "ADMIN", "MANAGER"],
  "work.read": ROLES,
  "work.manage": ["OWNER", "ADMIN", "MANAGER"],
  "agent.run": ["OWNER", "ADMIN", "MANAGER", "AGENT_OPERATOR"],
  "agent.manage": ["OWNER", "ADMIN"],
  "integration.read": ["OWNER", "ADMIN", "MANAGER"],
  "integration.manage": ["OWNER", "ADMIN"],
  "metrics.read": ROLES,
  "learning.manage": ["OWNER", "ADMIN", "MANAGER"],
  "audit.read": ["OWNER", "ADMIN"],
};

const activeBase = {
  identityStatus: "ACTIVE" as const,
  membershipStatus: "ACTIVE" as const,
  target: {
    type: "BRAND" as const,
    organizationStatus: "ACTIVE" as const,
    workspaceStatus: "ACTIVE" as const,
    brandStatus: "ACTIVE" as const,
  },
};

describe("canonical P2 role-capability matrix", () => {
  it("defines all 168 cells exactly", () => {
    expect(CAPABILITIES).toHaveLength(24);
    expect(ROLES).toHaveLength(7);

    for (const capability of CAPABILITIES) {
      for (const role of ROLES) {
        expect(ROLE_CAPABILITIES[role][capability]).toBe(
          EXPECTED_ALLOWED_ROLES[capability].includes(role),
        );
      }
    }
  });

  it("keeps approver and agent operator privileges narrow", () => {
    expect(ROLE_CAPABILITIES.APPROVER["content.approve"]).toBe(true);
    expect(ROLE_CAPABILITIES.APPROVER["content.write"]).toBe(false);
    expect(ROLE_CAPABILITIES.APPROVER["content.publish"]).toBe(false);
    expect(ROLE_CAPABILITIES.AGENT_OPERATOR["agent.run"]).toBe(true);
    expect(ROLE_CAPABILITIES.AGENT_OPERATOR["agent.manage"]).toBe(false);
    expect(ROLE_CAPABILITIES.AGENT_OPERATOR["rbac.manage"]).toBe(false);
  });
});

describe("deny-by-default authorization", () => {
  it("allows the union of positive roles down validated ancestry", () => {
    expect(
      evaluateAuthorization({
        ...activeBase,
        capability: "content.write",
        organizationRole: "VIEWER",
        workspaceRole: "MANAGER",
        brandRole: "EDITOR",
      }),
    ).toEqual({ allowed: true, reason: "ALLOWED" });
  });

  it.each([
    ["identity disabled", { identityStatus: "DISABLED" }],
    ["membership suspended", { membershipStatus: "SUSPENDED" }],
    ["membership revoked", { membershipStatus: "REVOKED" }],
  ])("denies when %s", (_label, override) => {
    expect(
      evaluateAuthorization({
        ...activeBase,
        ...(override as Partial<AuthorizationInput>),
        capability: "brand.read",
        organizationRole: "OWNER",
      }),
    ).toEqual({ allowed: false, reason: "INACTIVE_PRINCIPAL" });
  });

  it("denies an unknown capability and unknown role", () => {
    expect(
      evaluateAuthorization({
        ...activeBase,
        capability: "brand.delete" as Capability,
        organizationRole: "OWNER",
      }),
    ).toEqual({ allowed: false, reason: "UNKNOWN_CAPABILITY" });
    expect(
      evaluateAuthorization({
        ...activeBase,
        capability: "brand.read",
        organizationRole: "SUPERADMIN" as Role,
      }),
    ).toEqual({ allowed: false, reason: "UNKNOWN_ROLE" });
  });

  it("denies invalid target applicability and missing tenant ancestry", () => {
    expect(
      evaluateAuthorization({
        ...activeBase,
        capability: "workspace.lifecycle.manage",
        organizationRole: "OWNER",
      }),
    ).toEqual({ allowed: false, reason: "INVALID_TARGET" });
    expect(
      evaluateAuthorization({
        ...activeBase,
        capability: "brand.read",
        organizationRole: "OWNER",
        target: { ...activeBase.target, workspaceStatus: undefined },
      }),
    ).toEqual({ allowed: false, reason: "INVALID_ANCESTRY" });
  });

  it("denies mutations under archived ancestry but permits reads and exact recovery", () => {
    const archivedWorkspace = {
      ...activeBase,
      target: { ...activeBase.target, workspaceStatus: "ARCHIVED" as const },
      organizationRole: "OWNER" as const,
    };
    expect(
      evaluateAuthorization({ ...archivedWorkspace, capability: "content.write" }),
    ).toEqual({ allowed: false, reason: "ARCHIVED_SCOPE" });
    expect(
      evaluateAuthorization({ ...archivedWorkspace, capability: "brand.read" }),
    ).toEqual({ allowed: true, reason: "ALLOWED" });
    expect(
      evaluateAuthorization({
        identityStatus: "ACTIVE",
        membershipStatus: "ACTIVE",
        organizationRole: "ADMIN",
        capability: "workspace.lifecycle.manage",
        target: {
          type: "WORKSPACE",
          organizationStatus: "ACTIVE",
          workspaceStatus: "ARCHIVED",
        },
      }),
    ).toEqual({ allowed: true, reason: "ALLOWED" });
  });

  it("does not let a Brand admin recover a Workspace", () => {
    expect(
      evaluateAuthorization({
        identityStatus: "ACTIVE",
        membershipStatus: "ACTIVE",
        brandRole: "ADMIN",
        capability: "workspace.lifecycle.manage",
        target: {
          type: "WORKSPACE",
          organizationStatus: "ACTIVE",
          workspaceStatus: "ARCHIVED",
        },
      }),
    ).toEqual({ allowed: false, reason: "NO_GRANT" });
  });
});
