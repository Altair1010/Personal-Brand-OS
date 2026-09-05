# Review — PIL-WO-20260905-005-data-tenancy-rbac

Decision: BLOCKED_PENDING_OWNER_CONTRACT_APPROVAL

## Acceptance review

- Canonical baseline: PASS — `origin/master` and branch base were identical at P1 close SHA.
- Canonical contract extraction: PROPOSED — consequential semantics are explicit in the addendum but
  remain non-canonical until Owner approval.
- Schema/migration/backfill: NOT STARTED — correctly stopped before mutation.
- Tenant/RBAC isolation: NOT TESTABLE until the policy contract is approved.
- Regression baseline: PASS — 24 files and 118 tests; production build passed.
- Scope preservation: PASS — no schema, application, dependency, provider, UI, or P3 change.

## Proposed contract adversarial review

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

Severity: High implementation risk, unresolved until implementation verification

Resolution: Review generated SQL line-by-line; add bounded raw CHECK constraints; test populated and
fresh disposable databases; do not claim database-only enforcement for application checks.

### BACKUP VERSION GAP

Finding: Current version-1 backup omits every proposed canonical table.

Evidence: `lib/import-export/backup.ts` enumerates the existing models and import order.

Severity: Critical implementation risk, unresolved until implementation verification

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

Finding: No application route was changed.

Evidence: Work Order diff is documentation-only.

Severity: None

Resolution: Preserve this invariant during resumed additive implementation.

### ARCHITECTURE BOUNDARY VIOLATION

Finding: No P2 source code exists yet.

Evidence: P1 architecture tests pass in the baseline suite.

Severity: None

Resolution: Keep Prisma adapters in infrastructure and domain/application contracts provider-independent.

### SCOPE CREEP

Finding: None observed.

Evidence: No schema, application, dependency, provider, UI, P3, Worker, Agent Control Plane, or MCP change.

Severity: None

Resolution: Continue to preserve phase boundaries.

## Constitution/architecture review

- scope: PASS — analysis and durable blocker evidence only.
- boundaries: PASS — no new code or dependency.
- data safety: PASS — no database or schema mutation.
- observability: PASS — actual Git, source, test, build, Prisma, and typecheck evidence recorded.
- tests: baseline PASS; P2 tests correctly not fabricated.

## Required changes

1. Owner must approve or request changes to the proposed P2 model and permission contract.
2. Resume P2 on this branch only after the gate is resolved.
3. Use TDD and additive migration verification against fresh and populated disposable SQLite databases.

## Non-blocking notes

- The two standalone TypeScript errors are unchanged pre-existing baseline failures in
  `tests/ai/adapter-db-key.test.ts`.
- The Owner-supplied extracted technical package and ZIP remain untracked and unmodified.
