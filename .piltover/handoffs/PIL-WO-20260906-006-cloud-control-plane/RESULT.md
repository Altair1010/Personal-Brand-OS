# P3 — CLOUD CONTROL PLANE

STATUS: BLOCKED_PENDING_OWNER_CONTRACT_APPROVAL

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

The pre-schema entity and cross-cutting contract is recorded in `REQUEST.md`. Worker-Tenant
Authorization R1 is now proposed in `P3_WORKER_TENANT_AUTHORIZATION_ADDENDUM.md` and ADR-0002. It
requires exact, non-inheriting Workspace or Brand grants, P2 `agent.manage` at the exact target, and
authorization revalidation for every Worker-originated lease-bound mutation.

## DATA MODEL

Not mutated. Schema mutation: NONE. The R1 Owner gate in `REVIEW.md` must be approved first.

## STATE MACHINES

Contract only; application mutation: NONE.

## QUEUE

Contract only; implementation not started.

## LEASE

Contract only; implementation not started.

## EVENTS

Contract only; implementation not started.

## WORKERS

Registration, enabled state, capabilities, and exact tenant authorization are separate requirements.
The R1 proposal defines exact Workspace/Brand grants with no inheritance. Implementation is blocked
on Owner approval.

## APPROVALS

Contract only; implementation not started.

## RECONNECT

Contract only; implementation not started.

## HEALTH

Contract only; implementation not started.

## MIGRATION

Not created. P2 migration remains unchanged.

## TENANCY

P2 ancestry and RBAC remain canonical. No global or Organization-wide Worker authority was
invented. A Worker-executable Organization-only Job is rejected with `WORKER_SCOPE_REQUIRED`.
Grant or Worker revocation removes old-lease mutation authority without deleting the durable Job.

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
- Contract-only R1 proportional verification: PASS for JSON parsing, required artifact paths,
  documentation scope, `git diff --check`, and clean code/schema scope.

## DEPENDENCIES

Added: NONE.

## SCOPE AUDIT

P4: NO

P5: NO

UI: NO

Provider selection: NO

## LIMITATIONS

- Worker-Tenant Authorization R1 and ADR-0002 remain PROPOSED until Owner approval.
- No P3 implementation evidence exists yet.
- The existing lockfile audit reports 27 vulnerabilities (3 moderate, 22 high, 2 critical). No
  dependency was changed because dependency remediation is outside this Work Order.

## COMMITS

- `276723f8cc5c5a939d06a2e61c037817ed6892f2` — initial P3 contract-freeze checkpoint.
- R1 proposal: this contract-only commit; its exact SHA is verified after commit and push.

## REMOTE PHASE BRANCH

Checkpoint `276723f8cc5c5a939d06a2e61c037817ed6892f2` was pushed normally and independently verified on
`origin/work/PIL-WO-20260906-006-cloud-control-plane`. The contract-only R1 proposal is published by
the commit containing this RESULT after proportional verification.

## CANONICALIZATION

PENDING OWNER GATE. No master integration is authorized.

## ACCEPTANCE

BLOCKED_PENDING_OWNER_CONTRACT_APPROVAL. No schema or application implementation is authorized by
this proposal pass.

## NEXT LEGAL PHASE

Resume P3 implementation only after explicit Owner approval of Worker-Tenant Authorization R1. P4
remains blocked.
