# Review — PIL-WO-20260906-006-cloud-control-plane

Decision: BLOCKED_PENDING_OWNER_CONTRACT_APPROVAL

Proposal: Worker-Tenant Authorization R1 / Option A1

## Tenant escalation review

Finding: registration, enabled state, device metadata, and capabilities cannot authorize tenant
access.

Falsifier: give a Worker every required capability but no exact grant, then attempt claims in two
Organizations.

Expected evidence after implementation: both claims are denied; adding one exact grant enables only
the matching scope.

Severity: CRITICAL before a Worker claim surface exists.

Resolution: require a separate active exact Workspace or Brand grant plus P2 ancestry on claim and
every Worker-originated authoritative mutation. No public Worker mutation endpoint is authorized in
P3.

## Grant inheritance review

Finding: Organization-wide or Workspace-to-Brand inheritance silently expands machine authority.

Falsifier: grant Workspace A, then attempt a Job at child Brand A1, sibling Workspace B, and a Brand
in another Organization.

Expected evidence after implementation: every attempt is denied. Only a Workspace-only Job at exact
Workspace A is eligible.

Severity: HIGH.

Resolution: grants exist only at Workspace and Brand scopes and never inherit. The proposed physical
encoding uses separate scope-specific tables so exact identity and P2 compound ancestry can be
database-enforced in Prisma/SQLite.

## Revocation / lease review

Finding: claim-time-only authorization lets a revoked Worker retain power through an old lease.

Falsifier: Worker A claims with an active Brand grant; revoke the grant; A attempts renewal, event
append, and completion using the current lease.

Expected evidence after implementation: all authoritative mutations are denied before state change;
the Job and lease evidence remain durable and another eligible Worker can reclaim after explicit
reconciliation or expiry.

Severity: CRITICAL.

Resolution: revalidate current lease identity, Worker enabled/revoked state, exact active grant, and
P2 ancestry for every Worker-originated authoritative mutation. Lease fencing alone is necessary but
not sufficient.

## Organization-only Job review

Finding: RunRequest legally permits an Organization-only AgentRun, but P3 defines no
Organization-wide Worker authority.

Falsifier: enqueue a Worker-executable Job for a Run with neither Workspace nor Brand execution
scope.

Expected evidence after implementation: deterministic `WORKER_SCOPE_REQUIRED`; no Job row or
implicit Organization grant is created.

Severity: HIGH.

Resolution: preserve Organization-only AgentRuns while requiring a validated exact Workspace or
Brand scope at Worker Job enqueue.

## P4 boundary review

Finding: an internal application contract could become unsafe if exposed publicly while trusting a
caller-supplied `workerId`.

Falsifier: search P3 routes and domain/application imports for public Worker mutation endpoints,
machine credential handling, Codex JSON-RPC, WebSocket, SSE, or long-poll coupling.

Expected evidence after implementation: none exists. P3 exposes only internal mutation contracts and
read-only health; P4 owns enrollment credentials, machine authentication, and public transport.

Severity: CRITICAL if exposed; NONE while the boundary remains closed.

Resolution: explicitly defer machine authentication and public claim/reconnect transport to P4.

## Four-lane convergence

- Tenant security: PASS at proposal level. Exact grants and P2 ancestry provide no shortcut to an
  ungranted tenant.
- Temporal security: PASS at proposal level. Revocation zeroes mutation authority even when an old
  lease remains recorded.
- Control-plane durability: PASS at proposal level. Revocation never deletes or cancels the Job;
  normal expiry/reconciliation preserves retry and reclaim.
- P4 boundary: PASS at proposal level. No credential, public Worker mutation transport, daemon, or
  Codex bridge is included.

Implementation evidence is intentionally absent and no runtime PASS is claimed.

## Physical encoding comparison

### One WorkerTenantGrant table

One logical table is compact, but a nullable Brand column makes `(workerId, workspaceId, brandId)`
unsafe for Workspace uniqueness in SQLite because multiple `NULL` values do not conflict. A
polymorphic target ID also weakens ordinary Prisma foreign-key clarity. Raw partial unique indexes
and check constraints can repair this, at the cost of provider-specific migration complexity.

### WorkerWorkspaceGrant + WorkerBrandGrant

Two tables express direct compound P2 relations and ordinary unique keys for each exact target.
Queries can be hidden behind one logical authorization port. This is the proposed minimum safe
encoding for P3 implementation.

## Security case matrix

| Case | Proposed result |
|---|---|
| Capability match, no grant | DENY |
| Workspace A grant, Workspace B Job | DENY |
| Workspace A grant, Brand A1 Job | DENY |
| Brand A grant, Brand B Job | DENY |
| Brand A grant, Workspace A Job | DENY |
| Exact grant, Worker disabled/revoked | DENY |
| Exact grant, missing capability | DENY |
| Exact grant, invalid P2 ancestry | DENY |
| Grant revoked after claim | MUTATION DENIED; JOB PRESERVED |
| Grant revoked while offline | RECONNECT AUTHORITY DENIED |
| Organization-only Worker Job | `WORKER_SCOPE_REQUIRED` |
| Job execution scope outside AgentRun scope | DENY |
| Exact Workspace grant + exact Workspace Job + all other terms | ELIGIBLE |
| Exact Brand grant + exact Brand Job + all other terms | ELIGIBLE |

## Owner gate — P3 Worker-Tenant Authorization R1

Approve Option A1 as specified in `P3_WORKER_TENANT_AUTHORIZATION_ADDENDUM.md` and proposed
ADR-0002, and authorize bounded P3 implementation on the current phase branch?

Required response: YES / NO / CHANGES REQUIRED

Until YES, schema mutation and application mutation remain prohibited.
