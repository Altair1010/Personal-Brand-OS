# Review — PIL-WO-20260905-005-data-tenancy-rbac

Decision: BLOCKED

## Acceptance review

- Canonical baseline: PASS — `origin/master` and branch base were identical at P1 close SHA.
- Canonical contract extraction: FAIL — consequential authorization and physical-model semantics are incomplete.
- Schema/migration/backfill: NOT STARTED — correctly stopped before mutation.
- Tenant/RBAC isolation: NOT TESTABLE until the policy contract is approved.
- Regression baseline: PASS — 24 files and 118 tests; production build passed.
- Scope preservation: PASS — no schema, application, dependency, provider, UI, or P3 change.

## Adversarial review

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

1. Owner must approve the missing P2 model and permission contract.
2. Resume P2 on this branch only after the gate is resolved.
3. Use TDD and additive migration verification against fresh and populated disposable SQLite databases.

## Non-blocking notes

- The two standalone TypeScript errors are unchanged pre-existing baseline failures in
  `tests/ai/adapter-db-key.test.ts`.
- The Owner-supplied extracted technical package and ZIP remain untracked and unmodified.
