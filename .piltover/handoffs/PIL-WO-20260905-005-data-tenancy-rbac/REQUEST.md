# PIL-WO-20260905-005-data-tenancy-rbac — P2 Data, Tenancy, and RBAC

Status: BLOCKED
Phase: P2
Base ref expected: `9e3c8ff58b692b406a72ae7dd5f9cdfc7f8c5db1`

## Objective

Introduce the canonical Organization, Workspace, Brand, membership, RBAC, tenant-isolation,
backfill, and MetricObservation foundations through additive migrations while preserving legacy
PBOS data and behavior.

## Why now

P1 is canonical. P2 is the first authorized persistent-data migration and is required before later
feature seams can become tenant-scoped.

## Read set

- `AGENTS.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/00_META/SOURCE_OF_TRUTH.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/01_GOVERNANCE/`
- `docs/Piltover-Master-Technical-Package-v1.0.0/02_ARCHITECTURE/`
- `docs/Piltover-Master-Technical-Package-v1.0.0/03_DOMAIN/TENANCY_AND_RBAC.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/03_DOMAIN/DOMAIN_MODEL.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/03_DOMAIN/LEARNING_MODEL.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/04_DATA/`
- `docs/Piltover-Master-Technical-Package-v1.0.0/09_GITHUB_HANDOFF/`
- `docs/Piltover-Master-Technical-Package-v1.0.0/10_QUALITY/`
- `docs/Piltover-Master-Technical-Package-v1.0.0/11_MIGRATION/PBOS_TO_PILTOVER.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/12_PHASES/P2_DATA_AND_TENANCY.md`
- `.piltover/handoffs/PIL-WO-20260905-004-architecture-scaffold/RESULT.md`
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `prisma/seedCore.ts`
- relevant auth, backup, import/export, database, and test files

## Constraints

- All implementation must use canonical entity, role, permission, scope, deletion, and metric semantics.
- Unknown tenant scope or permission semantics fail closed.
- No schema mutation before consequential model ambiguity is resolved by the Owner.
- Additive forward migrations only; never edit shipped migrations.
- Preserve legacy data, identifiers, routes, behavior, and backup/restore compatibility.
- No production database mutation, UI redesign, provider migration, P3 work, or unrelated cleanup.
- No force push, rebase, squash, reset, or history rewrite.

## Acceptance criteria

- [ ] Canonical P2 physical tenancy and identity model is unambiguous.
- [ ] Canonical membership scope, role binding, capability vocabulary, and role-permission matrix are unambiguous.
- [ ] Canonical delete semantics and MetricObservation ownership/fields are unambiguous.
- [ ] Additive schema, migration, deterministic backfill, scoped repositories, and RBAC are implemented.
- [ ] Fresh and populated pre-P2 migration tests pass without data loss.
- [ ] Cross-organization, cross-workspace, cross-brand, foreign-relation, and missing-context tests fail closed.
- [ ] Backup/restore, seed, architecture, regression, build, and typecheck-delta gates pass.
- [ ] P2 branch is committed and pushed for Owner review without canonical master integration.

## Required verification

- Prisma format, validate, and generate.
- Fresh and populated SQLite migration tests, second-run/idempotency checks, and count/ID/null preservation.
- P2 targeted tenancy/RBAC/repository/MetricObservation tests.
- Existing architecture tests and full Vitest suite.
- Production build and standalone TypeScript baseline comparison.
- Diff, migration SQL, secret, dependency, and scope audits.

## Mutation/risk class

G4 for canonical schema integration. Local phase-branch implementation is authorized only after the
canonical model contract is unambiguous.

## Out of scope

- P3 and later phases
- application-wide PBOS feature migration
- UI or navigation changes
- provider, database-family, auth-provider, Worker, Agent Control Plane, MCP, or hosting changes

## Blocking canonical ambiguity

The canonical package defines seven role names but no capability vocabulary or role-permission
matrix. It also leaves the binding mechanism as `BrandMembership or scoped RoleBinding`, does not
define authorization inheritance across Organization, Workspace, and Brand, and does not fix the
physical identity mapping, delete semantics, or complete MetricObservation field/owner contract.
The P2 prompt explicitly requires an Owner Gate before schema mutation when these semantics remain
ambiguous.
