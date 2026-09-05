# P3 Worker-Tenant Authorization Addendum

## Status

APPROVED

The Owner approved Worker-Tenant Authorization R1 on 2026-09-06 against reviewed proposal commit
`1d5f2c1891a61d09eb7bf3ccb23960ca6c309fbe`. Approval authorizes bounded P3 implementation on
`work/PIL-WO-20260906-006-cloud-control-plane`. It does not authorize master integration,
production migration, deployment, P4, P5, Codex integration, machine enrollment credentials, or
public Worker mutation transport.

## Problem

A Worker capability describes what a machine can do. It does not describe which tenant data the
machine may access. Registration, enabled state, and capability matching therefore cannot authorize
a Worker to claim or mutate a Job for an Organization, Workspace, or Brand.

Without a separate tenant grant, a capable Worker could cross a tenant boundary merely by polling
the queue. P3 must fail closed and require both technical capability and explicit tenant authority.

## Trust Model

- **Registered** means the control plane knows the Worker identity and non-secret runtime metadata.
- **Enabled** means the Worker may participate operationally. Disabled or revoked Workers are denied.
- **Capable** means the Worker's normalized exact capabilities cover every required Job capability.
- **Authorized** means an active exact-scope Worker tenant grant covers the Job execution scope.

These properties are independent. None substitutes for another. Worker registration does not store
an enrollment credential, bearer token, Codex credential, password, API key, or other secret.

## Grant Scopes

### Workspace

A Workspace grant authorizes one Worker for Jobs whose execution scope is exactly the named
Organization and Workspace with no Brand. The Workspace must belong to that Organization.

### Brand

A Brand grant authorizes one Worker for Jobs whose execution scope is exactly the named
Organization, Workspace, and Brand. The Brand must belong to that Workspace and Organization.

P3 defines no Organization-wide Worker grant.

## Exact-Scope Semantics

Worker tenant grants do not inherit.

- A Workspace grant does not authorize any child Brand.
- A Brand grant does not authorize its parent Workspace.
- A Brand grant does not authorize a sibling Brand.
- A grant in one Organization never authorizes a scope in another Organization.

Capability values, device names, runtime adapters, protocol versions, and Worker metadata cannot
expand a grant.

## Organization-only Runs

The canonical RunRequest contract remains unchanged: `organizationId` is required, while
`workspaceId` and `brandId` are optional. An AgentRun may therefore be Organization-only.

AgentRun tenant scope and Worker execution scope are distinct. Persisting an Organization-only
AgentRun does not imply Organization-wide Worker authority.

## Worker-executable Job Requirement

Enqueuing a Worker-executable Job requires an exact Workspace or Brand execution scope validated
against the AgentRun and P2 ancestry. An Organization-only AgentRun may exist, but a caller cannot
enqueue its Worker-executable Job until an exact Workspace or Brand execution scope is supplied and
validated.

The execution scope must be contained by the AgentRun tenant scope: an Organization-only Run may
select a Workspace or Brand in that Organization; a Workspace Run may select that Workspace or one
of its Brands; and a Brand Run may select only that same Brand. The server rejects any sibling,
parent, or foreign-Organization scope instead of normalizing it.

An attempt to enqueue an Organization-only Worker Job fails deterministically with
`WORKER_SCOPE_REQUIRED`. P3 does not silently create an unclaimable Job and does not invent an
Organization-wide grant.

## Grant Authorization

Grant and revoke are human control-plane governance actions. The authenticated actor must resolve
to an active P2 UserIdentity with an active Membership and must be allowed `agent.manage` against
the exact target Workspace or Brand. P2 remains responsible for role evaluation, target lifecycle,
and tenant ancestry.

The operation must validate the supplied Organization, Workspace, and optional Brand as one P2
hierarchy before writing. Mismatched ancestry fails with the existing deterministic tenant error.
A Worker cannot create, reactivate, or revoke its own grant, and Worker-originated contracts expose
no grant mutation operation.

## Claim Eligibility

`CLAIM_ELIGIBLE` is true only when every term below is true:

1. The Job is in a claimable state.
2. The Job retry schedule is eligible at the supplied Clock time.
3. The Worker is registered.
4. The Worker is enabled and not revoked.
5. The Worker protocol and capability version are acceptable.
6. Every required Job capability is an exact member of the Worker's normalized capabilities.
7. The Job execution scope is exactly one Workspace or Brand scope.
8. One active exact Worker tenant grant covers that scope.
9. The Organization, Workspace, and optional Brand pass P2 ancestry and lifecycle validation.
10. No current authoritative lease prevents the atomic claim.

The evaluation uses deterministic exact equality. It does not use device-name routing, capability
substring matching, grant inheritance, or a global fallback.

## Revocation Semantics

Tenant authorization is evaluated at claim time and revalidated for every Worker-originated
authoritative mutation. At minimum this includes mark-running, lease renewal, Worker-authorized
RunEvent append, completion, failure/result submission, and reconnect reconciliation.

Revoking a grant immediately removes mutation authority. A lease acquired while the grant was
active remains historical evidence but cannot authorize a later mutation. Disabling or revoking the
Worker has the same fencing effect. Deterministic authorization rejection occurs before any state or
event mutation.

Grant or Worker revocation does not cancel or delete the Job or AgentRun. The current lease may
remain recorded until explicit reconciliation or expiry; the durable Job then becomes retryable or
terminally failed under the normal attempt policy and may be reclaimed by another eligible Worker.

## Reconnect Semantics

Reconnect revalidates Worker enabled state, the exact active grant, P2 ancestry, and current lease
identity. A Worker whose grant was revoked while offline cannot regain authority by presenting an
old lease or old acknowledged event sequence. The response reports that the lease is no longer
authoritative; it does not restore the grant or mutate queue state implicitly.

## Physical Model Requirements

The logical contract is one exact Worker tenant grant with:

- a stable grant ID;
- Worker ID;
- Organization ID;
- Workspace ID;
- optional Brand ID according to scope;
- scope type (`WORKSPACE` or `BRAND`);
- lifecycle (`ACTIVE` or `REVOKED`);
- creation time and creating UserIdentity;
- optional revocation time and revoking UserIdentity.

Capabilities, roles, credentials, device secrets, and arbitrary policy JSON are excluded.

The proposed physical encoding for P3 implementation is two scope-specific tables:
`WorkerWorkspaceGrant` and `WorkerBrandGrant`. This is the smallest Prisma/SQLite encoding that can
enforce exact-scope identity and P2 ancestry without polymorphic foreign keys or nullable-unique
ambiguity:

- Workspace identity is unique by `(workerId, workspaceId)` and uses the Workspace compound
  Organization relation.
- Brand identity is unique by `(workerId, brandId)` and uses the Brand compound
  Workspace/Organization relation.
- One row represents the stable grant identity for an exact scope. Re-grant transitions that row
  from `REVOKED` to `ACTIVE`; grant/revoke actions remain auditable.

A single `WorkerTenantGrant` table was considered. With nullable Brand scope, SQLite uniqueness does
not prevent duplicate `NULL` Workspace-grant identities, while a polymorphic target ID cannot carry
both strong Workspace and Brand foreign keys through ordinary Prisma relations. Raw partial indexes
and check constraints could compensate, but add migration and adapter complexity without improving
the contract. The two-table encoding is therefore proposed; callers may consume one logical grant
port independent of this storage detail.

## P4 Boundary

P3 implements only durable registry/grant facts and internal application contracts. It does not
expose a public Worker mutation endpoint that trusts a caller-supplied `workerId`.

Machine enrollment credentials, machine authentication, connection authentication, and public
claim/reconnect transport are deferred to P4. No Codex App Server, Codex JSON-RPC, Worker daemon,
WebSocket, SSE, or long-poll transport is introduced by this decision.

## Security Cases

Positive cases:

- Enabled Worker + required capabilities + exact Workspace grant + exact Workspace Job: eligible,
  subject to queue and lease rules.
- Enabled Worker + required capabilities + exact Brand grant + exact Brand Job: eligible, subject
  to queue and lease rules.

Negative cases:

- Capability match without a grant: denied.
- Workspace A grant for Workspace B Job: denied.
- Workspace A grant for Brand A1 Job: denied.
- Brand A grant for Brand B Job: denied.
- Brand A grant for Workspace A Job: denied.
- Exact Brand grant with a disabled or revoked Worker: denied.
- Exact grant with a missing required capability: denied.
- Exact grant with invalid or inactive P2 ancestry: denied.
- Grant revoked after claim: all later Worker-originated mutations using the old lease are denied.
- Grant revoked while Worker is offline: reconnect cannot restore authority.
- Organization-only Worker Job enqueue: denied with `WORKER_SCOPE_REQUIRED`.
- Job execution scope outside the AgentRun tenant scope: denied.

## Alternatives Rejected

- **Global Worker authority:** rejected because registration would become cross-tenant privilege.
- **Capabilities as authority:** rejected because technical ability is not authorization.
- **Organization-wide implicit grant:** rejected because it expands access to all current and future
  descendants and P2 defines no Organization-targeted Worker grant policy for P3.
- **Workspace-to-Brand inheritance:** rejected because it silently expands a Workspace grant to all
  child Brands and defeats exact least privilege.
- **Worker bound to a human identity:** rejected because device trust and human authorization have
  different lifecycles and should not change together implicitly.

## Open Questions

NONE
