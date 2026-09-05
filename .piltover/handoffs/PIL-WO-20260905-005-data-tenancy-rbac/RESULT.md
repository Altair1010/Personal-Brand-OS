# P2 — DATA + TENANCY + RBAC

STATUS: BLOCKED_PENDING_OWNER_CONTRACT_APPROVAL

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

## CONTRACT-RESOLUTION GATE

The seven model/security gaps were resolved into one bounded proposal without schema or application
mutation:

- Addendum: `.piltover/handoffs/PIL-WO-20260905-005-data-tenancy-rbac/P2_CANONICAL_CONTRACT_ADDENDUM.md`
- ADR: `docs/adr/0001-p2-tenancy-rbac-contract.md`
- Addendum status: `PROPOSED`
- ADR status: `PROPOSED`

Recommended contract summary:

- separate `UserIdentity` and provider auth subjects from retained `UserProfile`;
- active Organization Membership with optional Organization role plus FK-backed Workspace and Brand
  role bindings;
- one role per scope and union of positive grants down validated ancestry, with deny by default;
- 23 action capabilities and a complete matrix for all seven canonical roles;
- role-assignment ceilings, no scoped OWNER, and last-Organization-Owner protection;
- archive/disable/revoke lifecycle with restrictive foreign keys and no P2 hard-delete path;
- Brand-owned normalized typed MetricObservation rows with an optional legacy Post bridge;
- transactional one-tenant-graph-per-profile backfill and versioned backup compatibility.

Remaining unresolved contract questions: NONE inside the proposal. Owner approval or requested
changes are still required before the proposal becomes canonical or implementation resumes.

Schema mutation: NONE.

## DATA MODEL CONTRACT

Organization: proposed physical root with stable ID, display name, `ACTIVE|ARCHIVED` lifecycle,
timestamps, no name-based authority, and no P2 hard-delete path.

Workspace: proposed Organization child with compound same-tenant relation, inherited positive grants,
optional exact scoped binding, and archive-only P2 lifecycle.

Brand: proposed Workspace child and canonical business ownership boundary with explicit Organization
ancestry, exact scoped binding, and additive legacy BrandDNA link.

User/identity: proposed separate `UserIdentity` and `AuthIdentity` models retain `UserProfile` as
business/profile metadata. AppState's Supabase subject maps only to profile `local`; no provider is
fabricated for offline-only profiles and no auth provider is changed.

Membership: proposed unique actor/Organization relationship with nullable Organization role and
`ACTIVE|SUSPENDED|REVOKED` lifecycle. Membership without a role grants no visibility.

RBAC: the seven canonical roles are mapped across 23 action capabilities. Positive grants union from
Organization to exact Workspace and Brand bindings; missing/inactive/unknown/inconsistent state
denies. Assignment ceilings and last-owner safety are explicit.

MetricObservation: proposed normalized typed observation owned authoritatively by Brand, with an
optional legacy Post bridge, stable source-fact dedupe, explicit mapping for every MetricSnapshot
field, and null-as-unknown preservation.

## LEGACY OWNERSHIP MAP

Current reconnaissance identified the legacy ownership problem but no migration was authorized:

| Model family | Old owner | Intended canonical scope | Migration status | Compatibility retained |
|---|---|---|---|---|
| `UserProfile` | self/single profile | identity mapping | proposed unique nullable identity link | YES |
| `BrandDNA`, goals, audiences, pillars, strategies | `userId` | direct Brand scope | proposed nullable Organization/Brand links and exact profile graph | YES |
| ideas, drafts, posts | `userId` plus relation chains | direct or derived Brand scope | proposed exact profile graph plus relation validation | YES |
| `FacebookAccount` | `ownerRef` | Brand provider connection | proposed exact ownerRef/profile mapping; ambiguous rows quarantined | YES |
| `MetricSnapshot` | unique `postId` | MetricObservation source compatibility | proposed 0–7 observations per snapshot; snapshot retained | YES |
| `PerformanceInsight`, `ExportHistory` | `userId` | direct Brand scope | proposed nullable Organization/Brand links | YES |
| templates/frameworks/objectives | optional user/global | user rows Brand-scoped; null-user rows global | proposed conditional links; objectives remain global | YES |
| `PromptRun` / `AIModelConfig` | global/unscoped | legacy/system | unchanged unless an exact later owner is proven | YES |
| `AppState` | singleton | legacy only, never tenancy authority | unchanged | YES |

## FINAL TENANCY GRAPH

Not implemented. The proposed physical authorization graph is:

```text
AuthIdentity --> UserIdentity <-- UserProfile
                    |
                    +-- Membership --> Organization
                           |               |
                           |               +-- Workspace
                           |                      |
                           |                      +-- Brand
                           |                           |
                           +-- WorkspaceRoleBinding    +-- MetricObservation*
                           +-- BrandRoleBinding
```

The graph remains a proposal pending Owner approval; no table exists yet.

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

Permissions: PROPOSED — 23 action capabilities with a complete seven-role matrix.

Scope semantics: PROPOSED — nullable Organization role plus scope-specific FK-backed Workspace and
Brand bindings; positive grants union only down verified ancestry.

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

MetricObservation: physical contract PROPOSED; not implemented

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

git diff --check: PASS for the P1 base through the blocker-evidence commit.

## TYPECHECK BASELINE

Before: exactly two TS2352 errors at `tests/ai/adapter-db-key.test.ts:105` and `:140`.

After: unchanged; no TypeScript file was changed.

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

- The addendum and ADR are proposals, not canonical approval.
- No schema, migration, backfill, RBAC evaluator, repository, MetricObservation, or isolation test has
  been implemented.
- Production data volume and write concurrency are unknown; the proposal makes no zero-downtime claim.

## COMMITS

- `ec11ce83e810daecef34dc2f463a120c5c18894b` — record the P2 canonical-model gate and evidence.
- `626b492c59424256f505d16c7f49e4c7cec2aa3f` — close the original blocked P2 checkpoint.
- `9f2b0f8b86336ecedd60653f60924af9fdd02f23` — propose the P2 canonical contract and ADR.

The subsequent contract-gate metadata closeout commit is intentionally not self-referential; its exact SHA is
reported by Git and the final Owner report.

## REMOTE PHASE BRANCH

branch: `work/PIL-WO-20260905-005-data-tenancy-rbac`

proposal evidence checkpoint SHA: `9f2b0f8b86336ecedd60653f60924af9fdd02f23`

Remote verification is recorded after the metadata closeout commit is pushed.

## CANONICALIZATION

status: BLOCKED_PENDING_OWNER_CONTRACT_APPROVAL

## ACCEPTANCE

- PASS — P1 canonical baseline verified.
- PASS — exact available P2 sources recovered and searched.
- PASS — current Prisma ownership model inspected.
- PASS — every identified model ambiguity has one explicit minimum proposal.
- PASS — alternatives, security and migration consequences, SQLite feasibility, and reversal posture documented.
- PASS — proposed addendum and consequential ADR exist.
- FAIL — proposed contract is not canonical until Owner approval.
- FAIL — schema/migration/backfill/RBAC/MetricObservation implementation not started by design.
- PASS — legacy database, routes, dependencies, providers, UI, and application behavior unchanged.
- PASS — pre-P2 test/build/typecheck baseline remains historical evidence; this proposal changed no code.
- FAIL — technical completion remains blocked until contract approval and implementation verification.

## OWNER GATE — P2 CANONICAL CONTRACT APPROVAL

Question: Approve the proposed P2 canonical contract and authorize P2 schema, migration, RBAC, and
MetricObservation implementation on this phase branch?

Decision options: `YES`, `NO`, or `CHANGES REQUIRED`.

Canonical evidence: Technical Constitution C7 requires ambiguity to fail closed. The addendum now
supplies the missing decisions, but Change and ADR Policy requires Owner approval because they change
tenant trust boundaries, permission semantics, persistent schema, and lifecycle behavior.

Migration consequence: approval permits contract-first tests and additive implementation only. It
does not authorize master integration, production migration, provider changes, UI work, or P3.

Reversal path: no schema or database mutation has occurred. The proposal may be revised, rejected,
or superseded without data loss or history rewrite.

## NEXT LEGAL PHASE

P2 remains blocked. P3 is not eligible and has not started.
