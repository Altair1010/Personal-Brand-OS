# P2 — DATA + TENANCY + RBAC

STATUS: IN_PROGRESS_INTEGRITY_CLOSURE

R2 Owner review decision: CHANGES REQUIRED. The prior technical-completion claim is withdrawn while
relation-graph integrity and transitional-scope fail-closed behavior are under correction. P3 and
canonical reconciliation remain blocked.

## BASE

canonical master at start: `9e3c8ff58b692b406a72ae7dd5f9cdfc7f8c5db1`

P1 reachable: YES

branch: `work/PIL-WO-20260905-005-data-tenancy-rbac`

Work Order: `PIL-WO-20260905-005-data-tenancy-rbac`

## CANONICAL SOURCES

Implementation follows the approved `P2_CANONICAL_CONTRACT_ADDENDUM.md`, approved ADR-0001, P1
RESULT, and the P2 authority set recorded in `CONTEXT.json`. Owner approval applies to reviewed R1
SHA `7d8be5f197856574591bca2e4cb96d1cc7ba8ade`.

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
Supabase subject. Cross-user parent relations are validated before writes. Direct rows are scoped,
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
- Foreign Pillar/provider relation: PASS
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

- Prisma validate: PASS
- Prisma generate: PASS
- Fresh migration: PASS
- Populated pre-P2 migration: PASS
- Second migration deploy: PASS
- Backfill rerun: PASS
- Seed twice: PASS
- Architecture: PASS — 1 file, 6 tests
- P2 consolidated targeted: PASS — 6 files, 29 tests
- Full tests: PASS — 29 files, 141 tests, 0 failures
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

Changed: NO product behavior; one bounded pre-migration persistence compatibility select was added.

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
