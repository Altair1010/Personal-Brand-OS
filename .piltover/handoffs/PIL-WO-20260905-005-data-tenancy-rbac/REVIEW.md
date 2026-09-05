# Review — PIL-WO-20260905-005-data-tenancy-rbac

Decision: TECHNICALLY_COMPLETE — PENDING OWNER CANONICALIZATION

## Technical implementation adversarial review

### DATA LOSS

Finding: PASS for the populated disposable fixture. Evidence: IDs, text, JSON/string PromptRun
payloads, relations, metric nulls, and measured zero survive; `PRAGMA foreign_key_check` is empty.
Severity: Critical. Resolution: keep migration additive and require production backup/operational
planning outside P2 before any real deployment.

### TENANT ESCAPE / SIBLING LEAKAGE / CROSS-BRAND LEAKAGE

Finding: PASS. Evidence: compound ancestry FKs, server-resolved targets, exact membership lookup,
scoped binding lookup, missing-context denial, cross-Organization/Workspace/Brand negative tests,
and Pillar/provider injection guards. Severity: Critical. Resolution: new scoped operations use the
P2 access/guard surfaces; legacy paths remain explicit compatibility seams.

### RBAC BYPASS / ROLE ESCALATION

Finding: PASS. Evidence: one 24-capability registry drives all 168 role cells, invalid target pairs
deny, ADMIN cannot create or mutate OWNER/ADMIN governance, scoped ADMIN cannot mint governance
roles, self-elevation denies, and assignment is tenant-bound. Severity: Critical. Resolution: retain
separate capability evaluation and assignment-ceiling checks.

### PRIVILEGE RESURRECTION

Finding: PASS. Evidence: suspension retains grants but denies while suspended; revocation clears the
Organization role and revokes all scoped bindings in one transaction; generic resume rejects a
revoked row; readmission re-revokes bindings and activates with no role. Severity: Critical.
Resolution: fresh explicit role assignment is required after readmission.

### OWNER LOCKOUT

Finding: PASS. Evidence: suspend, revoke, demotion, and role removal check the active Owner count
inside their transaction; transfer writes the new Owner before demoting the old Owner. Severity:
Critical. Resolution: no ownerless Organization transition is exposed.

### PROMPTRUN DISCLOSURE

Finding: PASS. Evidence: complete-consumer proof runs only after direct scoping; unresolved or mixed
consumers remain null/conflict evidence; scoped reads require exact Organization and Brand; scoped
creation verifies Brand ancestry. Severity: Critical. Resolution: global-most-recent behavior remains
legacy-only and no new tenant API returns unowned runs.

### METRIC DUPLICATION / NULL FABRICATION

Finding: PASS. Evidence: dedupe uses tenant, measured owner, metric key, observation time, source,
and source record but excludes value; Brand/dedupe is unique; rerun creates zero rows; null emits no
fact while zero remains zero. Severity: Critical. Resolution: retain MetricSnapshot and idempotent
source mapping.

### SQLITE TABLE COPY LOSS / BAD CASCADE

Finding: PASS for reviewed SQL and fixtures. Evidence: every copied table uses an explicit old-column
`INSERT ... SELECT`; populated migration preserves values; all tenant/business FKs use RESTRICT,
except the approved MetricObservation legacy Post bridge uses SET NULL. Severity: High. Resolution:
no hard-delete API and no contract-phase cleanup in P2.

### BACKUP OMISSION / V1 UPGRADE FAILURE

Finding: PASS. Evidence: v2 enumerates all canonical models, restore order is FK-safe, v2 round-trip
passes, v1 restore invokes the same backfill, and cloud tests retain secret stripping. Severity:
Critical. Resolution: reject unknown backup versions and preserve PromptRun tenant keys.

### LEGACY ROUTE REGRESSION

Finding: PASS. Evidence: 29 files/141 tests and production build pass; the legacy PromptRun writer
uses an ID-only return selection so the pre-migration working DB does not require new columns.
Severity: High. Resolution: no route payload or UI change.

### ARCHITECTURE BOUNDARY VIOLATION

Finding: PASS. Evidence: Prisma is confined to infrastructure; the P1 architecture suite passes all
6 tests. Severity: High. Resolution: domain RBAC remains provider-independent.

### SCOPE CREEP

Finding: PASS. Evidence: no dependency, provider, UI, auth-provider, database-family, Worker, Agent
Control Plane, MCP, or P3 change. Severity: High. Resolution: stop at the canonicalization gate.

## Owner approval

Revision R1 was approved on 2026-09-06 at reviewed branch head
`7d8be5f197856574591bca2e4cb96d1cc7ba8ade`. The approval authorizes bounded P2 implementation on
the existing branch. It does not authorize canonical master integration, production migration,
deployment, provider migration, UI redesign, or P3.

## Acceptance review

- Canonical baseline: PASS — `origin/master` and branch base were identical at P1 close SHA.
- Canonical contract extraction: APPROVED — Revision R1 is the governing bounded implementation
  contract.
- Schema/migration/backfill: PASS — additive migration and deterministic backfill verified.
- Tenant/RBAC isolation: PASS — targeted negative and temporal tests verified.
- Regression baseline: PASS — 24 files and 118 tests; production build passed.
- Scope preservation: PASS — authorized P2 schema/application seams only; no dependency, provider,
  UI, or P3 change.

## Historical proposed-contract adversarial review

The sections below preserve the pre-implementation R1 threat analysis. Items described there as
future implementation requirements are resolved by the technical review above unless explicitly
listed as a current limitation.

### TEMPORAL PRIVILEGE RESURRECTION

Finding: The original proposal allowed a retained `REVOKED -> ACTIVE` toggle while Organization and
scoped roles could remain stored, allowing old privilege to return silently.

Evidence: R1 makes revocation atomically clear `organizationRole` and revoke every Workspace and
Brand binding. `REVOKED -> ACTIVE` is prohibited; READMISSION re-applies the zero-grant reset before
activation. Suspension is separately defined as a grant-preserving pause.

Severity: Critical design risk, corrected in R1

Resolution: Require negative tests for revoked former MANAGER/EDITOR readmission, suspended MANAGER
reactivation, revoked-binding persistence across Membership state changes, and atomic failure.

### WORKSPACE LIFECYCLE AUTHORITY

Finding: Workspace had an archive/reactivate lifecycle but the original 23-capability algebra had no
Workspace lifecycle authority.

Evidence: R1 adds `workspace.lifecycle.manage`, raises the matrix to 24 rows, grants it only to OWNER
and ADMIN, and applies it only to Workspace targets. Workspace ADMIN may manage descendant Brand
lifecycle through inherited `brand.lifecycle.manage`; Brand ADMIN cannot act on a Workspace.

Severity: High authorization gap, corrected in R1

Resolution: Test Organization ADMIN Workspace recovery, Workspace ADMIN Brand recovery, Brand ADMIN
Workspace denial, archived-ancestor denial, and the exact 24-row matrix.

### PROMPTRUN TENANT LEAKAGE

Finding: PromptRun stores input and model output derived from Brand data but the original proposal
left it globally unscoped, creating a hidden cross-tenant payload path for future APIs.

Evidence: Current Prisma relations connect PromptRun to StrategyVersion, ContentDraft, and
PerformanceInsight, and the current strategy action uses a global most-recent lookup. R1 confines
that lookup to legacy compatibility, adds nullable transitional Organization/Brand ownership,
accepts only complete unanimous consumer proof, classifies unresolved/conflicting rows, and bars
them from new tenant APIs.

Severity: Critical information-disclosure risk, corrected by contract

Resolution: Test same-tenant multi-consumer proof, no-consumer legacy classification, unresolved
consumer conflict, cross-tenant conflict, exact tenant query predicates, and versioned backup fields.
Run ownership proof only after all legacy consumer scopes are populated so an early per-profile pass
cannot hide a later conflicting consumer.

### AUTHIDENTITY OVER-CONSTRAINT

Finding: `UNIQUE(userIdentityId, provider)` was not required to prevent principal collision and would
permanently prohibit multiple accounts from one provider per principal.

Evidence: R1 retains only security-critical `UNIQUE(provider, subject)`. Profile separation, opaque
subjects, duplicate-subject migration blocking, and no-fabricated-subject rules remain unchanged.

Severity: Medium schema-debt risk, corrected in R1

Resolution: Verify duplicate `(provider, subject)` denial and permit distinct subjects from the same
provider to reference one UserIdentity. P2 still adds no account-linking UX.

### TEMPORAL STATE ATTACK MATRIX

| Scenario | Before | During | After/adversarial verdict |
|---|---|---|---|
| revoke -> reactivate | Assigned grants effective | Revocation clears/revokes all grants | Toggle denied; READMISSION is zero-grant. PASS by design. |
| suspend -> reactivate | Assigned grants effective | All access denied, grants retained | Grants intentionally return after authorized resume. PASS by explicit semantics. |
| archive parent -> recover child | Child effective | Parent archive suppresses descendant mutations | Child recovery denies until parent active; own archived state still applies. PASS by design. |
| revoke binding -> Membership change | Binding effective | Revoked binding inactive | Membership resume/readmission cannot revive it. PASS by design. |
| readmission with stale binding | Historical row exists | Fail-safe revokes every scoped row before ACTIVE | No capability until fresh assignment. PASS by design. |
| Organization role downgrade | Ancestor and descendant grants union | Post-change effective scopes calculated | Explicit descendant grants survive only at their scopes. Accepted, visible positive-grant semantics. |
| Organization role removal | Organization and scoped access | Organization grant removed | Exact active bindings remain; no Organization discovery. Accepted, auditable semantics. |
| Owner transfer | Existing Owner active | New Owner committed before old demotion | At least one active Owner remains. PASS by design. |
| last-Owner suspension | One active Owner | Transaction rechecks count | Denied. PASS by design. |
| identity disable -> enable | Tenant grants effective | All authorization denied while disabled | G4 recovery may restore disclosed stored grants after subject verification. PASS by explicit recovery semantics. |

### HIDDEN DATA-SCOPE AUDIT

Finding: A PromptRun-only correction could miss another globally classified Brand payload.

Evidence: The complete current Prisma schema was classified. AppState is legacy-unscoped and banned
from new tenant paths; PromptTemplate/ContentObjective/null-user templates and frameworks are shared
reference data; AIModelConfig is system configuration with secrets excluded; user-owned templates,
derived plans/versions/snapshots, and all direct user business models already have explicit direct,
conditional, or derived scope rules.

Severity: Critical audit question; no second critical global payload model found

Resolution: Keep PromptRun as the bounded R1 addition. Do not broaden P2 into application-wide AI or
AppState migration. Enforce exact ownership before any new tenant-aware exposure.

### IDENTITY COLLISION OR IMPERSONATION

Finding: Reusing `UserProfile` or inventing a local provider subject could turn mutable or
installation-local metadata into authentication authority.

Evidence: The proposal separates `UserIdentity` and `AuthIdentity`, applies AppState's subject only
to profile `local`, and creates no auth subject for an offline-only profile.

Severity: Critical design risk, mitigated by proposal

Resolution: Enforce unique `(provider, subject)`, a unique profile link, and halt on duplicate mapping.

### TENANT ESCAPE AND SIBLING LEAKAGE

Finding: A generic polymorphic binding or first-tenant fallback could cross Organization ancestry.

Evidence: Scope-specific bindings use compound Membership/Workspace/Brand ancestry FKs; the
authorization algorithm rejects missing or inconsistent ancestry before role evaluation.

Severity: Critical design risk, mitigated by proposal

Resolution: Keep scoped tables, exact target lookup, and no AppState/default-tenant fallback.

### BROAD MEMBERSHIP GRANT

Finding: Organization Membership alone could accidentally reveal every Workspace and Brand.

Evidence: `organizationRole` is nullable; Membership without a role grants no capability or scope
discovery. Exact scoped bindings grant only their scope and descendants.

Severity: Critical design risk, mitigated by proposal

Resolution: Test role-null Membership, sibling Workspace, sibling Brand, and missing-binding denial.

### ROLE UNION ESCALATION

Finding: Union inheritance intentionally prevents a lower-scope role from reducing an ancestor grant.

Evidence: Roles are positive grants only; Organization authority is expected to cover descendants.

Severity: Medium accepted trade-off

Resolution: Do not represent restrictive overrides in P2. To restrict an actor, lower or remove the
ancestor role and add exact scoped grants. Explicit deny semantics require a future approved ADR.

### ROLE ASSIGNMENT BYPASS

Finding: `rbac.manage` alone could let ADMIN mint OWNER/ADMIN peers or affect stronger memberships.

Evidence: The proposal adds assignment whitelists, target-role ceilings, same-tenant validation,
self-elevation denial, and last-owner checks independent of the capability matrix.

Severity: Critical design risk, mitigated by proposal

Resolution: Transactionally enforce and test every assigner/target role boundary.

### AGENT AND APPROVAL OVERREACH

Finding: Specialized roles could inherit unrelated business powers.

Evidence: AGENT_OPERATOR has run/read permissions only and APPROVER has read/approve only. Neither can
edit, publish, manage integrations, or manage RBAC.

Severity: Critical design risk, mitigated by proposal

Resolution: Keep publishing subject to both `content.publish` and a separate valid G3 approval.

### LAST OWNER AND ARCHIVE LOCKOUT

Finding: Owner revocation or cascade delete could orphan a tenant or erase history.

Evidence: Zero-owner transitions deny; a new Owner is created before transfer completes; P2 uses
archive/revoke/disable and RESTRICT FKs rather than hard-delete APIs.

Severity: Critical design risk, mitigated by proposal

Resolution: Serialize the mutation transaction as supported by SQLite and re-check active Owner count
immediately before commit.

### METRIC DUPLICATION OR LOSS

Finding: A value-based dedupe key rejects corrections incorrectly, while timestamp-only dedupe can
reject legitimate repeated observations. Null conversion could fabricate zeros.

Evidence: Dedupe includes tenant, measured owner, metric, time, source, and source record/operation ID
but excludes value. Each non-null legacy metric or note maps explicitly; null emits no row; the
original MetricSnapshot remains.

Severity: Critical design risk, mitigated by proposal

Resolution: Verify two-run idempotency, repeated-time distinct-source cases, all-null snapshots, and
field-by-field provenance preservation.

### SQLITE CONSTRAINT GAP

Finding: Prisma cannot express all CHECK and cross-row invariants, and SQLite may rebuild tables.

Evidence: The addendum distinguishes database-enforced compound FKs/uniques from transactionally
enforced owner count, lifecycle, and transitional relation checks.

Severity: High implementation risk, resolved by implementation verification

Resolution: Review generated SQL line-by-line; add bounded raw CHECK constraints; test populated and
fresh disposable databases; do not claim database-only enforcement for application checks.

### BACKUP VERSION GAP

Finding: Current version-1 backup omits every proposed canonical table.

Evidence: `lib/import-export/backup.ts` enumerates the existing models and import order.

Severity: Critical implementation risk, resolved by implementation verification

Resolution: Version the envelope, add parent-first restore order, retain v1 import followed by the
same backfill, and test both round trips before P2 technical completion.

### SCOPE CREEP

Finding: Custom roles, explicit denies, invitations, policy DSLs, MetricDefinition persistence, and
hard-purge workflows would exceed current consumers.

Evidence: The proposal explicitly defers them and adds no framework, service, provider, or UI.

Severity: None after correction

Resolution: Preserve the bounded proposal.

## Original blocker review

### DATA LOSS

Finding: Any implementation chosen now would require guessing backfill ownership and metric mapping.

Evidence: The package does not define physical identity mapping or the complete legacy-to-observation field mapping.

Severity: Critical

Resolution: Owner-approved canonical addendum before schema mutation.

### TENANT ESCAPE

Finding: Scope inheritance and RoleBinding placement are unresolved.

Evidence: The package states Brand-specific effective roles but does not say whether Organization
membership grants all Workspaces/Brands or how narrower grants override/inherit.

Severity: Critical

Resolution: Define scope hierarchy, inheritance, precedence, and deny behavior canonically.

### RBAC BYPASS

Finding: No role can be safely allowed any requested capability.

Evidence: Seven role names exist, but no capability vocabulary or role-permission matrix exists.

Severity: Critical

Resolution: Define exact permissions and allow/deny matrix; retain deny by default.

### CROSS-BRAND LEAKAGE

Finding: Brand access cannot be resolved from the current contract without inventing a binding model.

Evidence: `TARGET_SCHEMA.md` leaves `BrandMembership or scoped RoleBinding` as an alternative.

Severity: Critical

Resolution: Choose one canonical representation with compound constraints and inheritance rules.

### MIGRATION RETRY

Finding: Deterministic IDs cannot be finalized without the canonical identity and tenant uniqueness contract.

Evidence: Legacy `UserProfile` IDs and optional Supabase IDs coexist; canonical mapping priority is undefined.

Severity: Required

Resolution: Define stable mapping inputs and uniqueness before implementing an idempotent backfill.

### SQLITE TABLE COPY LOSS

Finding: No SQL has been generated, so no table-copy risk has been introduced.

Evidence: `prisma/schema.prisma` and shipped migrations remain unchanged.

Severity: None currently

Resolution: Review every generated statement and copied column after the contract is approved.

### CASCADE DELETE

Finding: The package forbids cascading important history by default but does not define exact tenant
hierarchy delete actions.

Evidence: `TARGET_SCHEMA.md` provides a principle, not Organization/Workspace/Brand FK actions.

Severity: Critical

Resolution: Canonicalize restrict/archive/cascade behavior before creating foreign keys.

### UNIQUE CONSTRAINT REGRESSION

Finding: Tenant-local versus global uniqueness is unresolved for new identities, memberships, and brands.

Evidence: The conceptual schema lists models without physical unique keys.

Severity: Required

Resolution: Define exact compound uniqueness in the canonical addendum.

### BACKUP OMISSION

Finding: Existing backup exports 22 legacy models and would omit every new P2 table.

Evidence: `lib/import-export/backup.ts` uses an explicit model envelope/import order.

Severity: Critical for resumed implementation

Resolution: Extend and round-trip the ownership graph in the same P2 change after schema approval.

### LEGACY ROUTE REGRESSION

Finding: No application route contract was changed.

Evidence: The P2 diff adds passive ownership/security seams and an ID-only legacy persistence
compatibility selection; it does not alter route payloads or UI behavior.

Severity: None

Resolution: Preserve this invariant during resumed additive implementation.

### ARCHITECTURE BOUNDARY VIOLATION

Finding: P2 source preserves the P1 direction.

Evidence: Domain RBAC has no provider import; Prisma code is under infrastructure; P1 checks pass.

Severity: None

Resolution: Keep Prisma adapters in infrastructure and domain/application contracts provider-independent.

### SCOPE CREEP

Finding: None observed.

Evidence: Only approved P2 schema/application seams changed; no dependency, provider, UI, P3,
Worker, Agent Control Plane, or MCP work occurred.

Severity: None

Resolution: Continue to preserve phase boundaries.

## Constitution/architecture review

- scope: PASS — approved P2 implementation only.
- boundaries: PASS — no new dependency and P1 checks pass.
- data safety: PASS — additive migration verified only on disposable databases.
- observability: PASS — actual Git, source, test, build, Prisma, and typecheck evidence recorded.
- tests: targeted, migration, full regression, build, and typecheck delta are actual run evidence.

## Required changes

1. Owner must approve or reject strict fast-forward canonical reconciliation of the technical P2 SHA.
2. Do not migrate production or the Owner's working database under this Work Order.
3. Do not begin P3 until canonical remote verification passes.

## Non-blocking notes

- The two standalone TypeScript errors are unchanged pre-existing baseline failures in
  `tests/ai/adapter-db-key.test.ts`.
- The Owner-supplied extracted technical package and ZIP remain untracked and unmodified.
