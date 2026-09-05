# P2 — DATA + TENANCY + RBAC

STATUS: TECHNICALLY_COMPLETE

CANONICALIZATION: PENDING_OWNER_CANONICALIZATION

R2 Owner review decision: CHANGES REQUIRED at reviewed head `b9ceb783c4d5c2f0f1594b6751fce097edc9681d`.
The corrective integrity closure is technically complete; P3 and canonical reconciliation remain
blocked pending the new Owner gate.

## BASE

canonical master at start: `9e3c8ff58b692b406a72ae7dd5f9cdfc7f8c5db1`

P1 reachable: YES

branch: `work/PIL-WO-20260905-005-data-tenancy-rbac`

Work Order: `PIL-WO-20260905-005-data-tenancy-rbac`

## CANONICAL SOURCES

Implementation follows the approved `P2_CANONICAL_CONTRACT_ADDENDUM.md`, approved ADR-0001, P1
RESULT, and the P2 authority set recorded in `CONTEXT.json`. Owner approval applies to reviewed R1
SHA `7d8be5f197856574591bca2e4cb96d1cc7ba8ade`.

## R2 INTEGRITY CLOSURE

Root cause: P2 assigned canonical Organization/Brand scope from each row's legacy owner, but the
complete business relation graph was not validated. A valid FK could therefore connect a child in
tenant A to a parent/provider in tenant B. Broad direct `updateMany` calls could also overwrite a
foreign or partial transitional scope pair and erase migration-conflict evidence.

R2 performs a global read-only relation and scope preflight before `ensureProfileGraph`. It validates
Goal, Plan, Pillar, Draft, Post, Framework, Facebook, PromptRun-consumer, and retry-state
MetricObservation/Post families. Direct rows accept only null/null or the exact pair derived from an
existing UserIdentity; updates target null/null rows only. Conflicts use stable family/record error
messages without payload or token data.

Files changed for R2:

- `lib/piltover/modules/platform/infrastructure/p2-backfill.ts`
- `tests/piltover/p2-relation-integrity.test.ts`
- `.piltover/handoffs/PIL-WO-20260905-005-data-tenancy-rbac/CONTEXT.json`
- `.piltover/handoffs/PIL-WO-20260905-005-data-tenancy-rbac/RESULT.md`
- `.piltover/handoffs/PIL-WO-20260905-005-data-tenancy-rbac/REVIEW.md`
- `.piltover/handoffs/PIL-WO-20260905-005-data-tenancy-rbac/STATUS.json`

Schema changes: NONE. Existing P2 migration changed: NO. Corrective migration: NONE.

## DATA MODEL CONTRACT

- Organization: physical `ACTIVE|ARCHIVED` tenant root with restrictive deletion.
- Workspace: Organization child with compound ancestry and independent lifecycle authority.
- Brand: Workspace child and authoritative business/metric owner.
- User/identity: separate UserIdentity, AuthIdentity, retained UserProfile, and only
  `UNIQUE(provider, subject)` for external-subject collision.
- Membership: one UserIdentity/Organization row, optional Organization role, and
  `ACTIVE|SUSPENDED|REVOKED` lifecycle.
- RBAC: seven roles, 24 capabilities, 168 explicit cells, positive inheritance, target
  applicability, assignment ceilings, and deny by default.
- MetricObservation: Brand-owned typed normalized fact with optional legacy Post bridge.

## LEGACY OWNERSHIP MAP

| Legacy family | Old owner | Canonical scope | Strategy | Compatibility |
|---|---|---|---|---|
| UserProfile | profile ID | UserIdentity | nullable unique link | retained |
| BrandDNA, Goal, AudienceSegment, ContentPillar, Strategy | userId | Brand | direct additive scope | retained |
| ContentIdea, ContentDraft, Post | userId/parents | Brand | direct scope plus parent validation | retained |
| PerformanceInsight, ExportHistory | userId | Brand | direct additive scope | retained |
| ContentTemplate, Framework | optional userId | Brand or global | user rows scoped | retained |
| FacebookAccount | ownerRef | Brand connection | exact match; unknown owner quarantined | retained |
| PromptRun | consumers | conditional Brand | complete-consumer proof only | retained |
| MetricSnapshot | Post | observation source | non-null facts emitted | retained |
| AppState, AIModelConfig, global references | singleton/system | legacy/global | never tenancy authority | retained |

## FINAL TENANCY GRAPH

```text
AuthIdentity --> UserIdentity <-- UserProfile
                    |
                    +-- Membership --> Organization
                           |               |
                           |               +-- Workspace
                           |                      |
                           |                      +-- Brand
                           |                           +-- PromptRun (proven only)
                           |                           +-- MetricObservation
                           +-- WorkspaceRoleBinding
                           +-- BrandRoleBinding
```

## SCHEMA CHANGES

Added UserIdentity, AuthIdentity, Organization, Membership, Workspace, WorkspaceRoleBinding, Brand,
BrandRoleBinding, and MetricObservation. Added approved nullable Organization/Brand ownership to
direct legacy scopes and PromptRun. Added compound tenant FKs, unique constraints, lookup indexes,
lifecycle/value CHECK constraints, and `(provider, subject)` uniqueness.

## MIGRATIONS

Migration name: `20260906004200_add_piltover_tenancy_rbac`

Migration SQL review: PASS. SQLite table copies preserve every pre-P2 column, add only nullable
transitional columns, recreate existing keys/indexes, and add restrictive relations. Generated
`DROP TABLE` statements only replace copied tables; no legacy model or column is absent afterward.

Destructive legacy operations: NONE.

## BACKFILL

One isolated graph is created per profile. Only profile `local` receives the non-empty AppState
Supabase subject. Complete deterministic cross-owner relations and existing scope pairs are
validated before writes. Direct null/null rows are scoped, exact pre-scoped rows are untouched,
unknown Facebook ownership is quarantined, PromptRun requires unanimous complete consumer proof,
and metric facts use idempotent SHA-256 source identity.

Representative populated fixture: 1 profile, 1 Organization, 1 Workspace, 1 Brand, 1 OWNER
Membership, and 4 observations from one partially-null MetricSnapshot. The second run created zero
canonical duplicates. A separate 2-profile fixture proves isolated graphs.

## RBAC

Roles: OWNER, ADMIN, MANAGER, EDITOR, VIEWER, APPROVER, AGENT_OPERATOR.

Permissions: exact 24-capability typed registry and 168-cell matrix.

Scope: Organization grants inherit downward; scoped bindings apply only to exact validated ancestry.
Unknown, missing, foreign, inconsistent, suspended, revoked, or disabled states deny.

Lifecycle: suspension preserves grants; revocation atomically clears the Organization role and
revokes scoped bindings; readmission starts with zero grants. The final active Owner cannot be
suspended, revoked, or demoted. Governance role assignment requires OWNER.

Seed: unchanged and executed twice on a disposable migrated database with stable counts.

## ISOLATION

- Cross-org: PASS
- Cross-workspace: PASS
- Cross-brand: PASS
- Goal relation family: PASS
- Plan relation family: PASS
- Pillar relation family: PASS
- Draft/Post relation family: PASS
- Global-or-tenant Framework: PASS
- Foreign Facebook provider relation: PASS
- Pre-existing scope mismatch/partial pair: PASS
- Preflight before canonical writes: PASS
- Missing tenant: PASS

## METRICS

MetricSnapshot remains unchanged. MetricObservation enforces NUMERIC/TEXT values and Brand/dedupe
uniqueness. SHA-256 dedupe excludes value. Null emits no observation; measured zero remains zero.

## LEGACY COMPATIBILITY

UserProfile, BrandDNA, userId, routes, and payloads remain. The legacy PromptRun writer selects only
its ID so a pre-migration Owner-local DB remains usable; new tenant paths require exact authorized
Organization and Brand scope.

## BACKUP / EXPORT IMPACT

Backup envelope v2 includes canonical entities and PromptRun tenant keys. Version 1 restores legacy
rows then invokes the same P2 backfill. FK-safe ordering and existing cloud secret stripping remain.
The v2 round-trip, v1 upgrade, secret stripping, and graph preservation tests pass.

## VERIFICATION

- R2 RED proof: PASS — the initial suite failed 20/20 assertions on the reviewed implementation;
  two additional pre-scoped PromptRun falsifiers also failed before correction.
- R2 relation suite: PASS — 1 file, 26 tests.
- P2 consolidated targeted: PASS — 7 files, 55 tests.
- Prisma validate: PASS — schema valid; only the existing Prisma 7 configuration deprecation warning.
- Prisma generate: NOT REQUIRED — R2 changed no schema.
- Fresh migration: PASS
- Populated pre-P2 migration: PASS
- Second migration deploy: PASS
- Backfill rerun: PASS
- Seed twice: PASS
- Architecture: PASS — 1 file, 6 tests
- Full tests: PASS — 30 files, 167 tests, 0 failures
- Production build: PASS — Next.js 15.3.4, 20 static pages
- Standalone typecheck: unchanged two TS2352 errors at
  `tests/ai/adapter-db-key.test.ts:105` and `:140`; new errors: 0
- git diff --check: PASS

## DATA LOSS EVIDENCE

The populated fixture preserved legacy IDs, profile/Brand text, PromptRun input/output, relations,
MetricSnapshot values, measured zero, and nulls. `PRAGMA foreign_key_check` returned no violations.
This proves the tested fixture, not production zero-downtime, concurrency, duration, or scale.

## DEPENDENCIES

Added: NONE.

## APPLICATION BEHAVIOR

Changed in R2: migration/backfill now fails closed on cross-tenant relations, pre-existing scope
conflicts, partial tenant pairs, and unproven pre-scoped PromptRuns. Product UI/runtime behavior is
otherwise unchanged.

## SCOPE AUDIT

P3: NO. UI redesign: NO. Provider migration: NO. Owner working DB migration: NO.

## LIMITATIONS

- Production volume, concurrent writes, and migration duration were not tested.
- Unresolved/conflicting PromptRuns remain intentionally unavailable to new tenant APIs.
- Only disposable databases were migrated.

## COMMITS

- `34c72bf7c447edb9a45f4ea69fdcd1324915d4ba` — approve Contract R1.
- `b82b0c8` — add tenant schema and migration.
- `660b22b` — add backfill, RBAC, scoped access, backup, and tests.
- `229699e` — preserve pre-migration PromptRun persistence.
- `fdd24d7` — enforce governance ceilings.
- `da3dd80` — record the R2 Owner integrity review and reopen the legal handoff state.
- `433c867` — enforce complete relation/scope preflight and add adversarial coverage.
- `886105e` — validate pre-existing PromptRun scope before consumer writes.

The closeout commit is reported by Git rather than self-referenced here.

## REMOTE PHASE BRANCH

branch: `work/PIL-WO-20260905-005-data-tenancy-rbac`

remote SHA: recorded after closeout push and fetch verification.

## CANONICALIZATION

status: PENDING_OWNER_GATE

## ACCEPTANCE

All P2 technical criteria pass. Canonical integration remains pending Owner approval. Production
migration/deployment, UI/provider work, and P3 were not started.

## NEXT LEGAL PHASE

P3 remains blocked until Owner-approved P2 canonical reconciliation and remote proof.
