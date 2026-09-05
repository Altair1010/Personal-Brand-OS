# ADR-0001: P2 Tenancy, RBAC, and Metric Observation Contract

## Status

APPROVED

The Owner approved Revision R1 at reviewed branch head
`7d8be5f197856574591bca2e4cb96d1cc7ba8ade` on 2026-09-06. Implementation is authorized only on
the existing P2 branch within the scope and gates recorded below.

## Context

P2 must create the Organization -> Workspace -> Brand data foundation, tenant-scoped authorization,
and time-series metrics while retaining PBOS data and behavior. The canonical package defines the
hierarchy, role names, and deny-by-default rule but leaves identity mapping, role persistence and
inheritance, permission semantics, lifecycle/delete behavior, and MetricObservation storage open.
Those choices change trust boundaries, permission semantics, and public persistent state.

## Decision

The approved decision is to:

- separate `UserIdentity` and provider auth subjects from retained `UserProfile` metadata;
- identify external subjects uniquely by `(provider, subject)` without restricting a principal to
  one subject per provider;
- use one durable Organization Membership with an optional Organization role and separate,
  FK-backed Workspace and Brand role bindings;
- treat suspension as grant-preserving pause, but make revocation clear the Organization role and
  revoke all scoped bindings; READMISSION is atomic and always returns with zero grants;
- allow one role per scope and union positive grants down the validated tenant hierarchy;
- use the bounded 24-capability matrix, including distinct `workspace.lifecycle.manage`, in the P2
  contract addendum;
- archive tenant entities, disable identities, and suspend/revoke memberships instead of exposing
  hard-delete cascades in P2;
- add nullable Organization/Brand ownership to tenant-sensitive PromptRun evidence, backfill only
  from unanimous complete consumer ownership proof, and exclude unresolved rows from new tenant APIs;
- make Brand the authoritative owner of normalized, typed MetricObservation rows while retaining an
  optional Post compatibility link and all legacy MetricSnapshot data;
- implement through additive, idempotent backfill and versioned backup/restore compatibility.

The exact fields, constraints, matrix, authorization algorithm, backfill, and metric mapping are in
`.piltover/handoffs/PIL-WO-20260905-005-data-tenancy-rbac/P2_CANONICAL_CONTRACT_ADDENDUM.md`.

## Alternatives considered

- Reuse `UserProfile` as the auth identity: lower migration cost, rejected because mutable profile
  metadata must not be the security principal.
- Put every role in a generic polymorphic RoleBinding: more theoretically extensible, rejected because
  SQLite cannot provide equally strong scope foreign keys and null-safe uniqueness.
- Store wide snapshot observations: simplest legacy mapping, rejected because each new metric would
  require schema change and repeat the current snapshot limitation.
- Add custom roles, multiple same-scope roles, explicit denies, ABAC, or a policy engine: rejected as
  unnecessary P2 complexity.

## Consequences

- Tenant and scoped-role ancestry can be proven with normal and compound SQLite foreign keys.
- Authorization is manually auditable and deny-by-default, with assignment ceilings and last-owner
  protection.
- Temporal authorization is explicit: only suspension/controlled recovery preserves grants;
  Membership revocation and binding revocation cannot resurrect stale privilege.
- Workspace lifecycle authority is separate from structural management, matching Organization and
  Brand lifecycle boundaries.
- PromptRun input/output is no longer a hidden global tenant-data path; unresolved legacy rows remain
  compatibility-only until ownership is proven.
- Two scope-specific binding tables and one auth-subject table are added compared with a polymorphic
  minimum.
- Some invariants require transactional application checks and targeted negative tests because
  Prisma/SQLite cannot express them declaratively.
- Backup format and restore ordering must include the new canonical graph.
- No hard delete, auth-provider replacement, external service, or RBAC framework is introduced.

## Migration and reversal plan

Use expand -> migrate -> contract: add canonical tables and nullable legacy links, validate legacy
ownership, backfill transactionally, verify counts/isolation/nulls/dedupe, extend backup/restore, and
leave legacy fields operational. No shipped migration is edited and no legacy column/table is dropped.
Before canonical cutover, the proposal can be rejected or superseded with no data change. After
implementation, reverse application behavior with a code rollback or use a forward corrective
migration; do not delete canonical rows written after adoption.

## Owner gate

G2/G4. This ADR changes permission semantics, tenant trust boundaries, and persistent lifecycle
contracts. Owner approval authorizes bounded local implementation and phase-branch publication. It
does not authorize canonical master integration, production migration, deployment, or P3.

## References and evidence

- `docs/Piltover-Master-Technical-Package-v1.0.0/01_GOVERNANCE/TECHNICAL_CONSTITUTION.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/01_GOVERNANCE/CHANGE_AND_ADR_POLICY.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/03_DOMAIN/TENANCY_AND_RBAC.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/03_DOMAIN/LEARNING_MODEL.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/04_DATA/TARGET_SCHEMA.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/04_DATA/MIGRATION_POLICY.md`
- `.piltover/handoffs/PIL-WO-20260905-005-data-tenancy-rbac/P2_CANONICAL_CONTRACT_ADDENDUM.md`
- `.piltover/handoffs/PIL-WO-20260905-005-data-tenancy-rbac/RESULT.md`
