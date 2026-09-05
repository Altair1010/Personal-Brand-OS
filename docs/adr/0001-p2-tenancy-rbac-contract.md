# ADR-0001: P2 Tenancy, RBAC, and Metric Observation Contract

## Status

PROPOSED

## Context

P2 must create the Organization -> Workspace -> Brand data foundation, tenant-scoped authorization,
and time-series metrics while retaining PBOS data and behavior. The canonical package defines the
hierarchy, role names, and deny-by-default rule but leaves identity mapping, role persistence and
inheritance, permission semantics, lifecycle/delete behavior, and MetricObservation storage open.
Those choices change trust boundaries, permission semantics, and public persistent state.

## Decision

Subject to Owner approval:

- separate `UserIdentity` and provider auth subjects from retained `UserProfile` metadata;
- use one durable Organization Membership with an optional Organization role and separate,
  FK-backed Workspace and Brand role bindings;
- allow one role per scope and union positive grants down the validated tenant hierarchy;
- use the bounded 23-capability matrix in the P2 contract addendum;
- archive tenant entities, disable identities, and suspend/revoke memberships instead of exposing
  hard-delete cascades in P2;
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
contracts. Only explicit Owner approval may change status from `PROPOSED` to `APPROVED` and authorize
P2 schema/migration/RBAC implementation.

## References and evidence

- `docs/Piltover-Master-Technical-Package-v1.0.0/01_GOVERNANCE/TECHNICAL_CONSTITUTION.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/01_GOVERNANCE/CHANGE_AND_ADR_POLICY.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/03_DOMAIN/TENANCY_AND_RBAC.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/03_DOMAIN/LEARNING_MODEL.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/04_DATA/TARGET_SCHEMA.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/04_DATA/MIGRATION_POLICY.md`
- `.piltover/handoffs/PIL-WO-20260905-005-data-tenancy-rbac/P2_CANONICAL_CONTRACT_ADDENDUM.md`
- `.piltover/handoffs/PIL-WO-20260905-005-data-tenancy-rbac/RESULT.md`
