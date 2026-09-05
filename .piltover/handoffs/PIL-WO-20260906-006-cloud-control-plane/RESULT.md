# P3 — CLOUD CONTROL PLANE

STATUS: BLOCKED

## BASE

Canonical master: `decb72cfae5749037020cf29c5b48b1f4f4fd3f8`

P2 reachability: PASS

Branch: `work/PIL-WO-20260906-006-cloud-control-plane`

Work Order: `PIL-WO-20260906-006-cloud-control-plane`

## CONTRACT SOURCES

The minimum canonical P3 source set, version 1.0 schemas, P2 canonical RESULT/STATUS, approved P2
contract, and ADR-0001 were inspected. P2 is reachable from `origin/master`, including its R2
integrity closure and additive migration.

## CONTRACT FREEZE

The pre-schema entity and cross-cutting contract is recorded in `REQUEST.md`. One consequential
trust-boundary decision remains unresolved: the physical Worker-to-tenant grant model and its P2
RBAC grant authority.

## DATA MODEL

Not mutated. The Owner gate in `REVIEW.md` must be resolved first.

## STATE MACHINES

Contract only; implementation not started.

## QUEUE

Contract only; implementation not started.

## LEASE

Contract only; implementation not started.

## EVENTS

Contract only; implementation not started.

## WORKERS

Registry/capability contracts are frozen. Tenant eligibility is blocked on the Owner decision.

## APPROVALS

Contract only; implementation not started.

## RECONNECT

Contract only; implementation not started.

## HEALTH

Contract only; implementation not started.

## MIGRATION

Not created. P2 migration remains unchanged.

## TENANCY

P2 ancestry and RBAC remain canonical. No global Worker authority was invented.

## VERIFICATION

- Initial clean-worktree run before Prisma generation: expected setup failure — 20 suites failed
  because `@prisma/client` had not been generated after `npm ci`; no source defect was inferred.
- Prisma Client generation: PASS — Prisma 6.19.3.
- Full baseline after setup: PASS — 30 files, 167 tests, 0 failures.
- Prisma validate: PASS — existing Prisma 7 configuration deprecation warning only.
- P1 architecture: PASS — 1 file, 6 tests.
- P2 targeted/integrity: PASS — 6 files, 49 tests.
- Production build: PASS — Next.js 15.3.4, 20 static pages.
- Standalone typecheck: baseline failure — the two canonical TS2352 errors remain at
  `tests/ai/adapter-db-key.test.ts:105` and `:140`.
- New type errors: 0, because no TypeScript source has been changed.

## DEPENDENCIES

Added: NONE.

## SCOPE AUDIT

P4: NO

P5: NO

UI: NO

Provider selection: NO

## LIMITATIONS

- The canonical package does not define the physical Worker tenant-grant representation or exact
  authority/inheritance rule.
- No P3 implementation evidence exists yet.
- The existing lockfile audit reports 27 vulnerabilities (3 moderate, 22 high, 2 critical). No
  dependency was changed because dependency remediation is outside this Work Order.

## COMMITS

Pending.

## REMOTE PHASE BRANCH

Pending.

## CANONICALIZATION

PENDING OWNER GATE. No master integration is authorized.

## ACCEPTANCE

BLOCKED before schema mutation on the Worker tenant-authorization contract decision.

## NEXT LEGAL PHASE

Resume P3 only after the Owner resolves the contract gate. P4 remains blocked.
