# P2 — DATA + TENANCY + RBAC

STATUS: BLOCKED

## BASE

canonical master at start: `9e3c8ff58b692b406a72ae7dd5f9cdfc7f8c5db1`

P1 reachable: YES

branch: `work/PIL-WO-20260905-005-data-tenancy-rbac`

Work Order: `PIL-WO-20260905-005-data-tenancy-rbac`

The P1 close commit, P1 Work Order result, module scaffold, boundary checker, ports, shared contracts,
and ADR mechanism were all verified from `origin/master`. The branch began with ahead/behind `0/0`.

## CANONICAL SOURCES

- `00_META/SOURCE_OF_TRUTH.md`
- `01_GOVERNANCE/TECHNICAL_CONSTITUTION.md`
- `01_GOVERNANCE/OWNER_GATES.md`
- `01_GOVERNANCE/CHANGE_AND_ADR_POLICY.md`
- `02_ARCHITECTURE/SYSTEM_ARCHITECTURE.md`
- `02_ARCHITECTURE/MODULE_BOUNDARIES.md`
- `02_ARCHITECTURE/PORTS_AND_ADAPTERS.md`
- `03_DOMAIN/TENANCY_AND_RBAC.md`
- `03_DOMAIN/DOMAIN_MODEL.md`
- `03_DOMAIN/LEARNING_MODEL.md`
- `04_DATA/TARGET_SCHEMA.md`
- `04_DATA/TARGET_DATA_ARCHITECTURE.md`
- `04_DATA/MIGRATION_POLICY.md`
- `04_DATA/BACKUP_AND_RECOVERY.md`
- `09_GITHUB_HANDOFF/CODEX_PLAYBOOK.md`
- `09_GITHUB_HANDOFF/HANDOFF_PROTOCOL.md`
- `10_QUALITY/ERROR_TAXONOMY.md`
- `10_QUALITY/SECURITY_MODEL.md`
- `10_QUALITY/TEST_STRATEGY.md`
- `11_MIGRATION/PBOS_TO_PILTOVER.md`
- `12_PHASES/P2_DATA_AND_TENANCY.md`
- P1 Work Order `RESULT.md`

## DATA MODEL CONTRACT

Organization: required canonical tenant root; physical fields, lifecycle, and deletion semantics are
not fully specified.

Workspace: required child of Organization; physical fields, membership inheritance, and deletion
semantics are not fully specified.

Brand: required child of Workspace; Brand-specific effective roles are allowed, but the canonical
binding representation and inheritance rules are unresolved.

User/identity: `UserIdentity / auth mapping` is required conceptually. The mapping from legacy
`UserProfile` and optional `AppState.supabaseUserId` is not specified sufficiently to choose a
physical identity contract without changing the auth model.

Membership: required between User and Organization. The package does not define required fields,
lifecycle, uniqueness, whether Workspace access is explicit or inherited, or how it composes with
Brand roles.

RBAC: canonical role names are `OWNER`, `ADMIN`, `MANAGER`, `EDITOR`, `VIEWER`, `APPROVER`, and
`AGENT_OPERATOR`. No canonical capability vocabulary or role-permission matrix is defined. The
package requires requested-capability evaluation and deny-by-default behavior, so a secure allow
path cannot be implemented without inventing policy.

MetricObservation: must support many observations per publication, source, metric, and timestamp.
The physical metric definition/value representation, authoritative owner during P2 legacy
compatibility, uniqueness/deduplication key, and mapping of all legacy `MetricSnapshot` fields are
not fully specified.

## LEGACY OWNERSHIP MAP

Current reconnaissance identified the legacy ownership problem but no migration was authorized:

| Model family | Old owner | Intended canonical scope | Migration status | Compatibility retained |
|---|---|---|---|---|
| `UserProfile` | self/single profile | identity mapping | BLOCKED pending identity contract | YES |
| `BrandDNA`, goals, audiences, pillars, strategies | `userId` | Brand or derived Brand scope | BLOCKED pending Brand/backfill contract | YES |
| ideas, drafts, posts | `userId` plus relation chains | Brand or derived Brand scope | BLOCKED pending scope rules | YES |
| `FacebookAccount` | `ownerRef` | unresolved integration scope | BLOCKED pending tenant scope | YES |
| `MetricSnapshot` | unique `postId` | initial MetricObservation compatibility | BLOCKED pending physical metric contract | YES |
| `PerformanceInsight`, `ExportHistory` | `userId` | unresolved tenant scope | BLOCKED pending classification | YES |
| templates/frameworks/objectives | optional user/global | global reference or tenant-owned depending row | no mechanical scoping performed | YES |
| `PromptRun` / `AIModelConfig` | global/unscoped | unresolved by P2 package | unchanged | YES |
| `AppState` | singleton | legacy only, never tenancy authority | unchanged | YES |

## FINAL TENANCY GRAPH

Not implemented. The approved conceptual graph is:

```text
UserIdentity
    |
    +-- Membership --> Organization
                           |
                           +-- Workspace
                                  |
                                  +-- Brand
```

The unresolved binding and inheritance semantics prevent an honest physical graph.

## SCHEMA CHANGES

NONE. `prisma/schema.prisma` was not modified.

## MIGRATIONS

Migration name: NONE

Migration SQL review: NOT APPLICABLE

Destructive operations: NONE

The explicit P2 model-ambiguity gate stopped work before schema mutation.

## BACKFILL

Legacy profiles: not mutated

Organizations created: 0

Workspaces created: 0

Brands created: 0

Memberships created: 0

Rows tenant-scoped: 0

MetricObservations created: 0

## RBAC

Roles: canonical names recovered; no persistence or evaluator implemented.

Permissions: BLOCKED — no canonical capability set or role-permission matrix exists in the package.

Scope semantics: BLOCKED — Brand-specific effective roles are stated, but Organization/Workspace
inheritance and the `BrandMembership or scoped RoleBinding` decision are unresolved.

Seed strategy: NOT IMPLEMENTED

Idempotency: NOT TESTED

## ISOLATION

Cross-org: NOT IMPLEMENTED

Cross-workspace: NOT IMPLEMENTED

Cross-brand: NOT IMPLEMENTED

Foreign relation: NOT IMPLEMENTED

Missing tenant: NOT IMPLEMENTED

## METRICS

MetricSnapshot compatibility: unchanged

MetricObservation: BLOCKED pending physical contract

Backfill: not implemented

Null preservation: no data mutated

## LEGACY COMPATIBILITY

UserProfile: unchanged

BrandDNA: unchanged

legacy userId: unchanged

current routes: unchanged

existing business behavior: unchanged

## BACKUP / EXPORT IMPACT

Result: the current backup layer explicitly exports all 22 legacy entities. Any new P2 tenancy
tables would be omitted unless the backup envelope/import order is extended.

Changes required: required when implementation resumes; none made while the physical schema is
blocked.

Tests: existing baseline backup tests passed as part of the full suite.

## VERIFICATION

Prisma validate: PASS — current pre-P2 schema is valid.

Prisma generate: NOT RUN; schema unchanged.

Migration fresh DB: NOT RUN; no migration exists.

Migration populated legacy DB: NOT RUN; no migration exists.

Migration second-run: NOT RUN; no migration exists.

Backfill idempotency: NOT RUN.

RBAC seed idempotency: NOT RUN.

Architecture tests: PASS within the full baseline suite.

P2 targeted tests: NOT CREATED; implementation is gated.

Full tests: PASS — 24 files, 118 tests, 0 failures.

Production build: PASS — Next.js 15.3.4 production build completed and generated 20 static pages.

Standalone typecheck delta: baseline recorded before P2 mutation; two pre-existing TS2352 errors
remain in `tests/ai/adapter-db-key.test.ts` at lines 105 and 140.

git diff --check: pending after Work Order evidence creation.

## TYPECHECK BASELINE

Before: exactly two TS2352 errors at `tests/ai/adapter-db-key.test.ts:105` and `:140`.

After: no source/schema implementation occurred; final documentation-only delta check pending.

New errors: 0 expected; no TypeScript files changed.

## DATA LOSS EVIDENCE

Before/after counts: no database operation occurred.

ID preservation: no database operation occurred.

relationship preservation: no database operation occurred.

No claim of migrated-data safety is made.

## DEPENDENCIES

Added: NONE.

## APPLICATION BEHAVIOR

Changed: NO.

## SCOPE AUDIT

P3 work: NO

UI redesign: NO

Provider migration: NO

## LIMITATIONS

- Permission semantics are incomplete: roles exist, capabilities and the role-permission matrix do not.
- Membership/role binding and scope inheritance are not canonicalized.
- Identity mapping, tenant deletion behavior, and MetricObservation physical ownership/fields are incomplete.
- P2 implementation, migration, and isolation verification cannot start without inventing consequential policy.

## COMMITS

Pending Work Order evidence commit.

## REMOTE PHASE BRANCH

branch: `work/PIL-WO-20260905-005-data-tenancy-rbac`

remote SHA: pending evidence commit/push

## CANONICALIZATION

status: BLOCKED BEFORE IMPLEMENTATION

## ACCEPTANCE

- PASS — P1 canonical baseline verified.
- PASS — exact available P2 sources recovered and searched.
- PASS — current Prisma ownership model inspected.
- FAIL — canonical P2 model is not sufficiently unambiguous for schema mutation.
- FAIL — schema/migration/backfill/RBAC/MetricObservation implementation not started by design.
- PASS — legacy database, routes, dependencies, providers, UI, and application behavior unchanged.
- PASS — pre-P2 test/build/typecheck baseline recorded.
- FAIL — technical completion and phase-branch implementation evidence cannot be produced before Owner decision.

## OWNER GATE — P2 MODEL DECISION

Question: What exact P2 authorization and physical-model contract should govern implementation?

Options:

1. Provide an approved canonical addendum defining identity mapping; Membership and RoleBinding
   fields, uniqueness, lifecycle, scope, and inheritance; capability names and the full role matrix;
   deletion semantics; and MetricObservation physical ownership, fields, and deduplication.
2. Explicitly approve a named minimal contract proposal as a new consequential ADR, after it is
   drafted and reviewed against current SQLite/Prisma constraints.
3. Narrow P2 to a specified non-RBAC/non-metric subset and revise its acceptance criteria.

Canonical evidence: Technical Constitution C7 blocks mutation on unknown tenant scope or permission
ambiguity. `TENANCY_AND_RBAC.md` lists roles and the resolution inputs but no permission matrix.
`TARGET_SCHEMA.md` explicitly leaves `BrandMembership or scoped RoleBinding` open and describes only
conceptual models. The P2 Work Order requires a gate for these exact ambiguities.

Current repo impact: choosing now determines irreversible public schema names, compound uniqueness,
foreign keys, backfill identity, authorization results, backup order, and migration SQL.

Migration consequence: proceeding without a decision risks ungrantable access, cross-tenant escape,
duplicate tenant graphs, incompatible backfill, or a later destructive schema rewrite.

Recommended minimum route: Option 1. Add only the missing canonical P2 contract, then resume the same
branch with contract-first tests and additive migration design.

Reversal path: no schema or database mutation has occurred. The Work Order evidence commit can be
forward-reverted or superseded after the Owner decision.

## NEXT LEGAL PHASE

P2 remains blocked. P3 is not eligible and has not started.
