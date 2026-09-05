# Review — PIL-WO-20260906-006-cloud-control-plane

Decision: TECHNICALLY_COMPLETE_PENDING_OWNER_CANONICALIZATION

## DOUBLE CLAIM

Finding: claim must not split one attempt between Workers.
Falsifier: two Prisma clients claim one queued Job concurrently.
Evidence: one claim fulfilled and one authoritative lease row remained.
Severity: CRITICAL.
Resolution: transaction, compare-and-swap, unique generation, and one Job current-lease pointer.

## STALE LEASE

Finding: an expired claimant could overwrite a reclaimed attempt.
Falsifier: A claims, expires, B reclaims, then A and B submit completion.
Evidence: A received `WORKER_STALE_LEASE`; B's result became canonical.
Severity: CRITICAL.
Resolution: opaque lease identity is required on every Worker-originated mutation.

## GRANT REVOKE AFTER CLAIM

Finding: claim-time-only tenant authorization is unsafe.
Falsifier: revoke the exact grant after claim, then renew, append an event, and complete.
Evidence: each post-revoke mutation was denied; concurrent revoke/result had one serialized canonical ordering.
Severity: CRITICAL.
Resolution: revalidate the active exact grant and ancestry at mutation time; preserve Job/lease history.

## WORKER DISABLE AFTER CLAIM

Finding: a lease must not outlive current Worker operational authority.
Falsifier: disable after mark-running, then renew and complete.
Evidence: both operations were denied and the Job remained durable.
Severity: CRITICAL.
Resolution: revalidate Worker status for authoritative mutation and reconnect.

## GRANT HISTORY / RE-GRANT AUDIT

Finding: reactivation can overwrite current-row revoke metadata.
Falsifier: grant, revoke, re-grant, revoke and reconstruct actors/times.
Evidence: four ordered append-only AuditEntry actions preserved the chronology.
Severity: HIGH.
Resolution: stable current grant row plus append-oriented governance evidence.

## CAPABILITY WITHOUT AUTHORITY

Finding: technical ability is not tenant authority.
Falsifier: register a capable Worker without a grant.
Evidence: claim returned no Job until the exact grant existed.
Severity: CRITICAL.
Resolution: capability and exact grant are independent claim terms.

## EXACT-SCOPE VIOLATION

Finding: Workspace-to-Brand or sibling inheritance would expand machine authority.
Falsifier: Workspace A grant against Brand A1; Brand A2 grant against Brand A1.
Evidence: both denied; exact Brand A1 grant enabled only Brand A1.
Severity: CRITICAL.
Resolution: separate Workspace/Brand grant tables and exact queries; no Organization grants.

## RUN/EXECUTION SCOPE CONTAINMENT

Finding: an execution scope could widen or cross a Run's tenant scope.
Falsifier: Organization-only Worker Job, Brand Run widened to Workspace, and foreign ancestry.
Evidence: `WORKER_SCOPE_REQUIRED`, `TENANT_SCOPE_NOT_CONTAINED`, or ancestry denial; no Job created.
Severity: CRITICAL.
Resolution: validate P2 ancestry and containment before enqueue.

## DUPLICATE RUN REQUEST

Finding: concurrent at-least-once delivery can pass a pre-read twice.
Falsifier: two clients create identical Run and Job concurrently, then change material under the same key.
Evidence: identical delivery returned one durable identity; changed material conflicted.
Severity: HIGH.
Resolution: scoped unique keys plus fingerprint checks at the persistence race boundary.

## EVENT DUPLICATION

Finding: duplicate event delivery could create duplicate evidence.
Falsifier: append the same sequence and material twice.
Evidence: the second append returned the existing row and count stayed one.
Severity: HIGH.
Resolution: stable material hash and `(runId, sequence)` uniqueness.

## EVENT SEQUENCE CONFLICT

Finding: reused or skipped sequence would make ordering ambiguous.
Falsifier: same sequence/different payload, concurrent writers, and sequence gap.
Evidence: one concurrent winner; conflict and gap were rejected.
Severity: CRITICAL.
Resolution: atomically validate the next exact sequence and fail closed on unique conflict.

## TERMINAL RESULT DUPLICATION

Finding: duplicate completion could alter terminal truth.
Falsifier: repeat identical completion after lease end/expiry, then submit different material.
Evidence: identical delivery was idempotent; changed material returned terminal conflict.
Severity: CRITICAL.
Resolution: terminal fingerprint and terminal-state guards.

## CANCEL/COMPLETE RACE

Finding: wall-clock order cannot decide simultaneous terminal mutations.
Falsifier: two clients cancel and complete one running Run.
Evidence: exactly one operation fulfilled and one terminal state persisted.
Severity: CRITICAL.
Resolution: serialize terminal state updates in database transactions.

## RETRY EXHAUSTION

Finding: lost Workers could cause infinite retry or permanent claim.
Falsifier: expire leases through `maxAttempts`, with a future `nextAttemptAt`.
Evidence: early claim skipped; due retry claimed; exhausted Job and Run became FAILED.
Severity: HIGH.
Resolution: increment only on lease grant, schedule explicitly, and fail at the limit.

## WORKER OFFLINE

Finding: absent Workers must not destroy queued work.
Falsifier: enqueue with no authorized Worker, then grant one later.
Evidence: Job stayed QUEUED and was later claimed.
Severity: HIGH.
Resolution: SQL queue truth is independent of live process presence.

## WORKER RECONNECT

Finding: offline local state can be stale or over-broad.
Falsifier: current, expired, reclaimed, cancelled, revoked, disabled, approval-decided, and no-lease-history scenarios.
Evidence: deterministic statuses/deltas were returned; a grant without lease history could not read a Run.
Severity: CRITICAL.
Resolution: rebuild authority from SQL, current Worker/grant facts, lease history, and exact event ordering.

## APPROVAL PAYLOAD MISMATCH

Finding: approval for one action/target/payload could be reused for another.
Falsifier: change payload or action during consumption.
Evidence: `APPROVAL_PAYLOAD_MISMATCH` and `APPROVAL_BINDING_MISMATCH`.
Severity: CRITICAL.
Resolution: canonical payload hash plus explicit action and target presentation at consumption.

## APPROVAL REPLAY

Finding: one-time approval could authorize two effects.
Falsifier: two Prisma clients consume one nonce concurrently.
Evidence: one success, one rejection, and one `consumedAt`.
Severity: CRITICAL.
Resolution: compare-and-swap on unconsumed approved state; reusable approvals remain explicitly non-consumed.

## APPROVAL EXPIRY

Finding: expired authority might remain usable.
Falsifier: advance Clock beyond expiry and decide/consume.
Evidence: operation denied and pending row persisted EXPIRED.
Severity: CRITICAL.
Resolution: ClockPort evaluation before decision/use; no cron dependency.

## PROCESS RESTART

Finding: in-memory canonical state would disappear.
Falsifier: persist all P3 facts, disconnect Prisma, reopen, and reconcile.
Evidence: Run, Job, lease, event, approval, Worker, and grant were reconstructed and reconciled.
Severity: CRITICAL.
Resolution: relational persistence is authoritative.

## HEALTH READ SIDE EFFECTS

Finding: observability must not mutate queue truth.
Falsifier: read health with an expired unreconciled lease and compare Job before/after.
Evidence: counts reported the expired lease while Job status/current lease remained unchanged.
Severity: HIGH.
Resolution: separate read-only health from explicit reconciliation.

## CROSS-TENANT ACCESS

Finding: supplied IDs or Worker capability could bypass P2.
Falsifier: two Organizations attempt foreign read, cancellation, grant, approval, events, claim, and scope containment.
Evidence: every foreign operation was denied.
Severity: CRITICAL.
Resolution: server-side P2 authorization and compound ancestry constraints.

## P4 SCOPE CREEP

Finding: public Worker transport without machine authentication would trust caller-supplied identity.
Falsifier: inspect P3 routes/imports for Worker mutation endpoint, credential, daemon, socket, or Codex runtime.
Evidence: only read-only health is routed; Worker mutation/reconnect remains internal and transport-independent.
Severity: CRITICAL if crossed.
Resolution: machine enrollment, connection authentication, public transport, and runtime bridge remain deferred.

## P5 SCOPE CREEP

Finding: resolving role/context/permission references would pull P5 forward.
Falsifier: inspect schema and implementation for fake future entities or compiler/resolver logic.
Evidence: references remain opaque and no P5 entities or services were added.
Severity: HIGH.
Resolution: persist versioned references without interpreting them.

## SECRET STORAGE

Finding: event/result/Worker metadata could become a credential dump.
Falsifier: submit nested bearer token, API key, or credential-named metadata.
Evidence: payloads were rejected before persistence; schema contains no machine-secret field.
Severity: CRITICAL.
Resolution: shared obvious-secret-key guard at persistence boundaries; full DLP remains out of scope.

## SIX-LANE CONVERGENCE

- State: PASS — explicit transitions and terminal guards.
- Concurrency: PASS — persistence-level double-claim, dedupe, terminal, grant, event, and approval races.
- Durability: PASS — restart, offline Worker, expiry, approval pause, and retry evidence.
- Idempotency: PASS — Run, Job, event, result, cancellation, and approval decision semantics.
- Security: PASS — exact grant, current authority, P2 ancestry/RBAC, containment, and secret rejection.
- Transport: PASS — no Codex/runtime/socket/machine-auth coupling or public Worker mutation surface.

## REVIEW VERDICT

No Critical or Required finding remains unresolved. P3 is technically complete on its phase branch.
Canonicalization remains a separate Owner gate; P4 remains blocked.
