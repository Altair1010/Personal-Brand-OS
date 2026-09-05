# ADR-0002: Exact Worker-Tenant Authorization

## Status

APPROVED

Approved by the Owner on 2026-09-06 against reviewed proposal commit
`1d5f2c1891a61d09eb7bf3ccb23960ca6c309fbe`. Approval is limited to bounded P3 implementation on
the existing P3 phase branch; the exclusions in the Owner gate remain in force.

## Context

P3 needs durable Worker registration, capability routing, claims, and lease-bound mutations. The
canonical package requires tenant-safe Workers but does not define the persistent relationship that
authorizes a Worker for a tenant. Treating registration or capabilities as authority would let a
technically capable machine cross Organization, Workspace, or Brand boundaries.

The canonical RunRequest permits Organization-only AgentRuns, while P2 applies `agent.manage` to
Workspace and Brand targets. Machine enrollment credentials and authenticated public transport are
P4 concerns.

## Decision

Use explicit, non-inheriting Worker grants at exactly one Workspace or one Brand:

- Workspace grants authorize Workspace-only Worker Jobs at that exact Workspace.
- Brand grants authorize Brand Jobs at that exact Brand.
- P3 defines no Organization-wide Worker grant.
- Organization-only AgentRuns remain valid, but their Worker-executable Job enqueue fails with
  `WORKER_SCOPE_REQUIRED` until a validated Workspace or Brand execution scope exists.
- Grant/revoke requires an active P2 actor authorized for `agent.manage` at the exact target.
- Capability coverage, Worker enabled state, exact active grant, P2 ancestry, and queue/lease rules
  are independent claim requirements.
- Exact grant and Worker status are revalidated for every Worker-originated authoritative mutation;
  revocation makes an old lease insufficient immediately while preserving the durable Job.
- P3 exposes no unauthenticated public claim or reconnect mutation endpoint.

The detailed behavioral contract is recorded in
`.piltover/handoffs/PIL-WO-20260906-006-cloud-control-plane/P3_WORKER_TENANT_AUTHORIZATION_ADDENDUM.md`.

## Alternatives considered

- Global or Organization-wide Worker authority: simpler to administer, but creates a substantially
  broader blast radius and access to future descendant scopes.
- Capabilities as tenant authority: fewer records, but confuses ability with permission and permits
  cross-tenant escalation.
- Workspace grants inherited by Brands: convenient, but silently expands authority beyond the exact
  approved target.
- Bind Worker authority to a UserIdentity: reuses human grants, but conflates machine and human trust
  lifecycles.
- One polymorphic grant table: possible with raw SQLite constraints, but ordinary Prisma relations
  cannot enforce both target kinds as clearly as two scope-specific tables, and nullable uniqueness
  is unsafe for Workspace rows.

## Consequences

- Claim evaluation is fail-closed, least-privilege, and directly auditable.
- More explicit grants are required when one Worker serves multiple scopes.
- Workspace grants do not reduce the administrative work for Brand Jobs because inheritance is
  intentionally absent.
- The proposed implementation can use scope-specific grant tables with compound P2 foreign keys and
  database-enforced exact-scope uniqueness while exposing one logical grant port.
- Every lease-bound Worker mutation pays an authorization revalidation cost so revocation is
  temporally effective.
- Revocation removes authority without deleting the Job, lease history, run, or event evidence.
- P4 remains responsible for machine credentials and authenticated public transport.

## Migration and reversal plan

Before approval, reject or revise the proposal without data impact because no schema or application
change exists. After approval, add the grant representation through the new additive P3 migration
and implement it behind a logical application port. A future broader policy must use a new ADR and
forward migration; it must not reinterpret existing exact grants. Revoke existing grants or roll
back application behavior without deleting historical control-plane evidence.

## Owner gate

G2/G4 approved on 2026-09-06. This ADR changes the Worker machine trust boundary, tenant
permission semantics, and lease mutation authority. Approval authorizes only bounded P3
implementation on the current P3 branch. It does not authorize master integration, production
migration, deployment, P4, P5, Codex integration, machine enrollment credentials, or public Worker
mutation transport.

## References and evidence

- `docs/Piltover-Master-Technical-Package-v1.0.0/01_GOVERNANCE/CHANGE_AND_ADR_POLICY.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/03_DOMAIN/TENANCY_AND_RBAC.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/06_CODEX_BRIDGE/JOB_LEASE_AND_RECONNECT.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/10_QUALITY/SECURITY_MODEL.md`
- `docs/adr/0001-p2-tenancy-rbac-contract.md`
- `.piltover/handoffs/PIL-WO-20260906-006-cloud-control-plane/P3_WORKER_TENANT_AUTHORIZATION_ADDENDUM.md`
- `.piltover/handoffs/PIL-WO-20260906-006-cloud-control-plane/REVIEW.md`
