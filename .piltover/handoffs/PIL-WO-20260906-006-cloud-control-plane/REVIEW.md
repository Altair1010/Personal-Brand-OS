# Review — PIL-WO-20260906-006-cloud-control-plane

Decision: OWNER CONTRACT GATE REQUIRED BEFORE SCHEMA MUTATION

## OWNER GATE — P3 CONTRACT DECISION

### Missing decision

What persistent scope grants authorize a registered Worker to claim Jobs belonging to an
Organization, Workspace, or Brand, and which P2 actor authority may create/revoke those grants?

### Canonical evidence

- The runtime topology expects one authorized Worker initially and supports N Workers.
- The security model makes Worker enrollment revocable and requires server-enforced tenant
  isolation.
- The claim equation requires both exact capability coverage and Worker tenant authority.
- The Worker registration schema contains identity/runtime/capability metadata but no tenant scope.
- P2 applies `agent.run` and `agent.manage` to Workspace or Brand targets, not Organization targets.
- Capability match and device name are explicitly not tenant authorization.

### Option A — Exact Workspace/Brand grants (recommended)

Persist a restrictive `WorkerScopeGrant` for either one Workspace or one Brand, with compound P2
ancestry constraints. A P2 actor with `agent.manage` on that exact target may grant/revoke it.
Organization-only Jobs are not claimable until a later approved Organization-level policy exists.

Security consequence: least privilege and direct reuse of the approved P2 capability applicability;
more grant rows are required when one Worker serves many scopes.

Reversal path: revoke grants, retain historical rows, and supersede through a forward migration if
a later policy adds broader scope.

### Option B — Organization-wide grants

Persist `WorkerOrganizationGrant`; an Organization Owner/Admin authorizes a Worker for every current
and future Workspace/Brand in that Organization. A new exact grant-authority mapping must be
approved because P2 has no Organization-targeted `agent.manage` capability.

Security consequence: simpler operations but materially broader blast radius and implicit access to
future descendant scopes.

Reversal path: revoke the Organization grant and migrate to narrower grants, preserving history.

### Option C — Bind Worker to a human identity and derive access dynamically

Link Worker to `UserIdentity` and derive eligibility from that identity's active P2 Membership and
Workspace/Brand bindings.

Security consequence: avoids a second grant graph but conflates durable device trust with human
authorization lifecycle and can silently change Worker reach when human roles change.

Reversal path: remove the identity link through a forward migration and issue explicit device grants.

### Minimum recommendation

Approve Option A. It is the smallest fail-closed model that reuses existing P2 authorization
semantics, prevents capability-only tenant access, supports N Workers, and does not invent an
Organization-wide authority capability. Enrollment credentials and public claim transport remain
deferred to P4; P3 exposes only internal application contracts and a read-only health route.

### Owner decision requested

Approve Option A, select Option B/C, or provide a different explicit Worker tenant-authorization
contract. No Prisma/schema mutation will occur until this decision is recorded.

## Pre-implementation six-lane review

- State: terminal states remain terminal and all mutations use explicit transition tables.
- Concurrency: atomic claim plus opaque lease generation is mandatory.
- Durability: SQL is authoritative; no in-memory queue or scheduler is required.
- Idempotency: scoped request hash, event hash, and terminal result hash fail closed on mismatch.
- Security: P2 ancestry/RBAC is reused; Worker capability never implies tenant access.
- Transport: domain/application contracts contain no Codex JSON-RPC, WebSocket, SSE, or long-poll
  dependency.

## Adversarial sections

DOUBLE CLAIM, STALE LEASE COMPLETION, LEASE EXPIRY RACE, DUPLICATE RUN REQUEST, DUPLICATE EVENT,
EVENT SEQUENCE CONFLICT, DUPLICATE TERMINAL RESULT, CANCEL / COMPLETE RACE, RETRY EXHAUSTION,
WORKER DISCONNECT, WORKER REVOCATION, CROSS-TENANT WORKER CLAIM, CROSS-TENANT APPROVAL, APPROVAL
PAYLOAD REPLAY, APPROVAL EXPIRY, PROCESS RESTART, QUEUE STARVATION, SECRET LEAKAGE, TRANSPORT
COUPLING, and P4/P5 SCOPE CREEP remain implementation review obligations. No PASS is claimed before
their falsifiers run.
