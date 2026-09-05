# P3 — CLOUD CONTROL PLANE

STATUS: TECHNICALLY_COMPLETE

## BASE

- Canonical master: `decb72cfae5749037020cf29c5b48b1f4f4fd3f8`.
- P2 reachability: PASS; canonical P2, ADR-0001, its additive migration, and the R2 integrity closure remain ancestors.
- Branch: `work/PIL-WO-20260906-006-cloud-control-plane`.
- Work Order: `PIL-WO-20260906-006-cloud-control-plane`.
- Relationship at implementation checkpoint: fast-forward safe, 12 commits ahead and 0 behind canonical master.

## APPROVED CONTRACTS

- `P3_WORKER_TENANT_AUTHORIZATION_ADDENDUM.md`: APPROVED.
- `docs/adr/0002-worker-tenant-authorization.md`: APPROVED.
- Owner-reviewed contract SHA: `1d5f2c1891a61d09eb7bf3ccb23960ca6c309fbe`.
- The canonical package schemas and P2 tenant/RBAC contract govern the implementation. No consequential P3 ambiguity remains open.

## DATA MODEL

The additive `20260906040000_add_piltover_control_plane` migration adds `AgentRun`, `Job`,
`RunEvent`, `Worker`, `WorkerCapability`, `WorkerLease`, `WorkerWorkspaceGrant`,
`WorkerBrandGrant`, `ApprovalRequest`, and `AuditEntry`. Composite relations retain P2
Organization/Workspace/Brand ancestry. Control-plane history uses restrictive deletes.

## STATE MACHINES

Explicit AgentRun, Job, and Approval transition tables reject illegal and terminal-state
resurrection. Application operations invoke these authorities instead of exposing a generic status setter.

## QUEUE

- The relational database is the durable queue source of truth; delivery is explicitly at least once.
- Run and Job creation are idempotent, including concurrent identical delivery; changed material conflicts deterministically.
- Claim order is priority descending, creation age ascending, then stable ID ascending.
- `nextAttemptAt`, explicit retry activation, and `maxAttempts` are enforced.
- No eligible/online Worker is required for a Job to remain durably queued.
- No exactly-once execution guarantee is made.

## LEASE / FENCING

- Claim uses a transaction plus compare-and-swap and was falsified with two Prisma clients.
- Every attempt receives a new opaque lease ID and monotonic attempt/generation.
- Job `currentLeaseId` is the sole authoritative lease pointer; historical leases remain append-oriented evidence.
- Renewal, Worker events, completion, result submission, and reconnect revalidate lease identity, Worker state, capabilities, exact active tenant grant, and P2 ancestry.
- Expiry ends the old lease and moves the Job to delayed retry or terminal failure at exhaustion.
- Old completion after reclaim is rejected; identical already-committed terminal delivery is an idempotent read with no duplicate effect.

## WORKER REGISTRY

Worker identity, enabled/revoked state, normalized exact capabilities, runtime/protocol metadata,
capability version, registration time, and heartbeat facts are persisted. No machine credential is
stored. Fresh/stale health is derived from `lastSeenAt` and `ClockPort`.

## WORKER TENANT AUTHORIZATION

- Workspace and Brand grants are physically separate exact-scope records.
- There is no Organization grant and no inheritance in either direction.
- Capability and registration do not grant tenant authority.
- Worker-executable Jobs require exact Workspace or Brand execution scope contained by Run scope.
- Grant/revoke requires P2 `agent.manage` at the exact target.
- Grant revocation and Worker disable make an old lease insufficient for new mutation while preserving the Job for reclaim.
- Internal contracts remain behind the future machine-auth boundary; no public Worker mutation route exists.

## GRANT AUDITABILITY

The current grant row supports active-state checks. Append-oriented `AuditEntry` records preserve
grant, revoke, re-grant, and second-revoke chronology with actor, target, correlation, and time.
Worker disable/revoke, lease grant/reclaim/expiry, cancellation, approval decisions, and terminal
Run results also produce durable evidence.

## EVENTS

RunEvent is append-only with unique `(runId, sequence)`, strict next-sequence validation, stable
material hashes, ascending reads after N, and obvious-secret metadata rejection. Identical duplicate
delivery returns the existing event; changed material at the same sequence and gaps fail closed.
Worker-originated events require current authority.

## RESULTS

Canonical RunResult v1.0 is persisted with a stable terminal fingerprint. Same-lease identical
terminal material is idempotent, including later delivery after the ended lease. Conflicting
terminal material, cancellation, stale lease, revoked grant, disabled Worker, and obvious
secret-bearing error details are rejected.

## CANCELLATION

Queued, claimed/running, and waiting-approval cancellation is durable and idempotent. It terminates
active lease authority, cancels pending approvals, and prevents stale completion. A two-client
cancel/complete race produced exactly one terminal winner.

## APPROVAL

Requests bind exact action type, target reference, canonical payload hash, tenant scope, P2
capability, actors, and expiry. Consumption presents action, target, and payload again. One-time
nonce consumption uses compare-and-swap; two consumers yield at most one success. Reusable
approvals do not fabricate one-time consumption state. Expiry is ClockPort-evaluated. Approval
pause survives lease expiry and only releases retry after approved consumption.

## RECONNECT

The internal transport-independent contract reports current, expired, reclaimed, cancelled,
unauthorized, and disabled lease states; ordered event deltas; durable approval actions; and eligible
Job count. It validates protocol/capability version, Worker/grant state, lease history, and ancestry.
A grant alone cannot read arbitrary Run history. No socket or Codex transport is selected.

## HEALTH

`GET /api/piltover/control-plane/health` returns schema-versioned database, queue, oldest eligible
age, Worker freshness, lease, and Run-state facts. It is read-only and never reconciles, expires,
retries, cancels, or updates canonical state. Database failure returns a machine-readable envelope.

## MIGRATION

- Fresh database: PASS.
- Populated canonical P2 database: PASS.
- Second deploy: PASS.
- P2 row counts before/after: unchanged.
- `PRAGMA foreign_key_check`: no violations.
- SQL review: 10 additive table creates and 27 query-driven indexes; no P2 ALTER/DROP/DML.
- Lock profile: SQLite schema-write locks occur only while creating new objects on disposable databases. Production migration was not run or authorized.
- Development rollback is disposal of the disposable database; no destructive production rollback is proposed.

## TENANCY

Two-Organization tests deny foreign Run reads, cancellation, grant mutation, approval decisions,
event history, and Worker claims. Compound ancestry and Run/execution containment fail closed. A
Workspace grant does not imply child Brand data access; P5 context/permission resolution remains opaque.

## DURABILITY

A restart integration test persists Run, Job, lease, event, approval, Worker, and exact grant,
disconnects Prisma, opens a new client against the same database, reconstructs every fact, and
safely reconciles the expired lease. Worker offline never deletes or fails a valid queued Job.

## VERIFICATION

- Baseline full suite: PASS — 30 files / 167 tests.
- Final P3 targeted suite: PASS — 10 files / 70 tests.
- Persistence races: PASS — double claim, concurrent Run/Job delivery, event sequence, grant/revoke-result, cancel/complete, and approval consumption.
- Restart durability: PASS.
- Migration fresh/populated/second deploy and P2-count preservation: PASS.
- P1 architecture + P2 critical suites: PASS — 7 files / 55 tests.
- Final full repository suite: PASS — 40 files / 237 tests.
- Production build: PASS — Next.js 15.3.4; health route included; 20 static pages generated.
- Prisma format/validate/generate: PASS — Prisma 6.19.3. Existing Prisma 7 configuration deprecation warning only.
- Standalone TypeScript: the same baseline TS2352 diagnostics remain at `tests/ai/adapter-db-key.test.ts:105` and `:140`; new errors = 0.
- `git diff --check`: PASS.

## DEPENDENCIES

Added: NONE. `package.json` and lockfile are unchanged. The existing dependency tree reports 27
audit advisories (3 moderate, 22 high, 2 critical); remediation is not introduced by P3 and was not
mixed into this Work Order.

## SCOPE AUDIT

- Codex JSON-RPC/App Server: NO.
- Personal Worker daemon, machine credential, or public Worker transport: NO.
- P5 role resolver, Context Compiler, or fake future entities: NO.
- MCP, production UI, cloud provider, VPS, Redis, broker, scheduler, or microservice: NONE.

## COMMITS

- `02c7d1264f0917a60ba499a9b8d33dfa0734e801` — approve Worker/Tenant R1.
- `e1306b80aaae24c608529492c9eea119c01338c1` — freeze approved physical contract.
- `a8ad7fd3e950eb6bfe900d57b000625aef632464` — add schema and migration.
- `f88cd667dde3a6f7902c1a5a77021e7397265970` — add transport contracts and state machines.
- `b9502234a5f3616a3d5df0c74daca1a6a982c77f` — add Worker registry and exact grants.
- `4031fe3a3c3d0c845ee5781ea019b668392e6563` — add queue and lease fencing.
- `7db6497db8e4da7370b869cda7abbf67f1ca5e2c` — add events and cancellation.
- `0641bc54478059e376f962e5b8d8192f0f5dc307` — add approvals, reconnect, and health.
- `0c398f1b2e4be8353d3680fd1c75c104e886e37f` — add failure-path evidence.
- `b9df074f8b930aea670bb05fab8da76a6cf9e88d` — close adversarial review gaps.

## REMOTE PHASE BRANCH

Implementation checkpoint `b9df074f8b930aea670bb05fab8da76a6cf9e88d` was pushed normally.
After fetch, local HEAD, remote-tracking P3 ref, and independent `git ls-remote` output were equal.
`origin/master` remained `decb72cfae5749037020cf29c5b48b1f4f4fd3f8`. The documentation closeout
commit containing this result must be pushed as a normal descendant and verified before reporting the Owner gate.

## LIMITATIONS

- SQLite race tests prove the current adapter, not production-scale SQL concurrency equivalence.
- Queue candidate/reconnect scans are intentionally simple for initial scale; measured load may later justify pagination or provider-specific claim SQL.
- Approval expiry is derived at use time; no scheduler exists solely to flip status rows.
- Machine authentication and public Worker transport are deferred to P4.
- Pre-existing dependency advisories and two baseline TypeScript diagnostics remain unchanged.

## ACCEPTANCE

TECHNICALLY_COMPLETE. Canonicalization is not authorized by this state.

## CANONICALIZATION

PENDING OWNER GATE. The only proposed operation is a strict fast-forward of master to the final
verified P3 branch SHA, subject to fresh ancestry and remote-state proof after Owner approval.

## NEXT LEGAL PHASE

P4 remains BLOCKED until P3 is CANONICAL_DONE. Do not start P4.
