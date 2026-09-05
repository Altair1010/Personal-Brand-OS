# Work Order — PIL-WO-20260906-006-cloud-control-plane

## Objective

Implement P3 as a durable, tenant-safe, transport-independent relational control plane for
AgentRun, Job, RunEvent, Worker, WorkerLease, and ApprovalRequest state. The control plane must
remain correct under duplicate delivery, concurrent claims, expired leases, stale completion,
cancellation, approval pause, reconnect, and process restart.

## Authorized scope

- Add the P3 data models and one additive forward migration.
- Implement version 1.0 runtime/typed contracts for RunRequest, RunEvent, RunResult, Worker
  registration, Approval, and the existing ErrorEnvelope.
- Implement explicit AgentRun, Job, and Approval state machines.
- Implement SQL-backed enqueue, atomic claim, lease fencing/renewal/expiry/reclaim, retry limits,
  cancellation, terminal result idempotency, event append/history, Worker registry, approval,
  reconnect, and read-only health application contracts.
- Reuse P2 tenant ancestry and RBAC. Keep infrastructure details behind ports.
- Add failure-path, race-oriented, restart-durability, migration, and tenant-negative tests.
- Commit and push only the P3 phase branch after technical verification.

## Non-goals

No P4 worker, Codex App Server, Codex JSON-RPC, WebSocket stack, P5 role/context compiler, MCP, UI,
VPS, cloud-provider selection, queue product, scheduler daemon, microservice split, production
migration, deployment, canonical master integration, or exactly-once claim.

## Contract sources

- `00_META/SOURCE_OF_TRUTH.md`
- `01_GOVERNANCE/TECHNICAL_CONSTITUTION.md`
- `01_GOVERNANCE/OWNER_GATES.md`
- `01_GOVERNANCE/CHANGE_AND_ADR_POLICY.md`
- `02_ARCHITECTURE/SYSTEM_ARCHITECTURE.md`
- `02_ARCHITECTURE/MODULE_BOUNDARIES.md`
- `02_ARCHITECTURE/PORTS_AND_ADAPTERS.md`
- `02_ARCHITECTURE/RUNTIME_TOPOLOGY.md`
- `02_ARCHITECTURE/STATE_AND_EVENT_MODEL.md`
- `03_DOMAIN/WORK_MODEL.md`
- `04_DATA/TARGET_SCHEMA.md`
- `04_DATA/TARGET_DATA_ARCHITECTURE.md`
- `05_AGENT_CONTROL/AGENT_CONTROL_PLANE.md`
- `05_AGENT_CONTROL/AUTONOMY_AND_APPROVAL.md`
- `06_CODEX_BRIDGE/JOB_LEASE_AND_RECONNECT.md`
- `06_CODEX_BRIDGE/BRIDGE_SPEC.md`
- `10_QUALITY/ERROR_TAXONOMY.md`
- `10_QUALITY/OBSERVABILITY.md`
- `10_QUALITY/SECURITY_MODEL.md`
- `10_QUALITY/TEST_STRATEGY.md`
- `12_PHASES/P3_CLOUD_CONTROL_PLANE.md`
- Canonical version 1.0 JSON schemas in the package `schemas/` directory.
- Approved P2 contract and ADR-0001.

## Contract freeze

| Entity | Responsibility | Tenant scope | Fields / references | State machine | Unique keys | Idempotency | Concurrency control | Delete / retention | Errors | Port owner |
|---|---|---|---|---|---|---|---|---|---|---|
| AgentRun | Durable requested execution and terminal result | Required Organization; optional validated Workspace and Brand ancestry | Request snapshot/hash, opaque role/context/permission refs, correlation, status, terminal result/hash, timestamps | Explicit canonical transitions; terminal states never revive | ID; `(organizationId, idempotencyKey)` when key is present | Same scoped key plus same material request returns existing; changed payload conflicts | Transactional compare-and-swap transition | Restrict; no normal hard delete; retained evidence | `AGENT_*`, `TENANT_*`, `PERMISSION_*` | agents application/domain |
| Job | Durable queue item distinct from AgentRun | Derived from AgentRun | priority, required capabilities, status, attempt count/max, next attempt, timestamps | QUEUED/CLAIMED/RUNNING/RETRY_PENDING/COMPLETED/FAILED/CANCELLED | One active canonical Job per run; scoped enqueue key through run | Re-enqueue returns same material Job; conflicts fail closed | Atomic deterministic claim and guarded terminal mutation | Restrict; retained | `QUEUE_*`, `WORKER_*` | JobQueuePort |
| RunEvent | Immutable ordered run evidence | Derived from AgentRun; reads require tenant authorization | sequence, event type, timestamp, correlation, safe payload, worker, content hash | Append only | `(runId, sequence)` | Same sequence/hash returns existing; changed hash conflicts | Transactional expected-next append | No normal update/delete; retained | `AGENT_EVENT_*`, `WORKER_LEASE_*` | agents application |
| Worker | Durable device/runtime/capability registry | Registry identity is not tenant authority | device metadata, runtime/protocol, enabled/revoked facts, last seen, capability version | Enabled/disabled/revoked facts; health derived from Clock | worker ID; normalized capabilities per Worker | Same registration material is safe; incompatible identity conflicts | Transactional registry mutations | Disable/revoke; no credential or secret storage | `WORKER_*` | WorkerRegistryPort |
| WorkerCapability | Exact normalized routing capability | Inherits Worker identity; never grants tenant access | worker ID, exact capability string, version/timestamps | Replaced/updated through registry command | `(workerId, capability)` | Dedupe exact values | Registry transaction | Restrict with retained Worker; no substring matching | `WORKER_CAPABILITY_*` | WorkerRegistryPort |
| WorkerLease | Exclusive, expiring, fenced execution authority | Job tenant plus a separately proven Worker tenant grant | opaque lease ID, job, worker, generation/attempt, issued/expires/released/completed facts | Active authority ends on release, completion, cancellation, expiry, or newer generation | One authoritative active lease per Job enforced transactionally; lease ID unique | Same authoritative completion/result hash is safe | Atomic grant; every bound mutation compares job/worker/lease/generation and current authority | Retain evidence; never silently delete Job | `WORKER_LEASE_EXPIRED`, `QUEUE_STALE_LEASE`, `QUEUE_CONFLICT` | JobQueuePort |
| ApprovalRequest | Payload-bound consequential-action decision and optional one-time consumption | Explicit Organization and optional validated Run/target scope | action, target, payload hash, requester/decider, expiry, nonce, consumed facts | PENDING to one terminal decision; expired/cancelled cannot decide or consume | approval ID; one-time nonce where present | Duplicate same decision safe; changed/double decision conflicts; one-time consumption CAS | Transactional decision/consume with Clock and P2 RBAC | Retained; no normal hard delete | `APPROVAL_*`, `TENANT_*`, `PERMISSION_*` | ApprovalPort |

## Frozen cross-cutting semantics

- Delivery is at least once. No exactly-once execution guarantee is made.
- Attempt count increments only when a new authoritative execution lease is granted.
- Claim order is priority descending, eligible creation time ascending, then stable Job ID.
- A future `nextAttemptAt` is not claimable. Expiry reconciliation makes the Job retryable or
  terminally failed when attempts are exhausted.
- Time-sensitive behavior uses ClockPort; IDs use IdGeneratorPort.
- Required capabilities use exact normalized set inclusion. Device name is never routing authority.
- Worker freshness is derived from persisted enabled/revoked/last-seen facts and Clock policy.
- Event order is sequence-based, not timestamp-based. Obvious secret-bearing payload keys are
  rejected before persistence.
- Health is read only and never reconciles leases.
- All Workspace/Brand scope supplied by a RunRequest must resolve under its Organization.
- Historical run/event/approval/lease evidence is restrictive and append-oriented; P3 adds no purge.

## Unresolved consequential decision

The package requires authorized Workers and tenant-safe claims but does not define the physical
Worker-to-Organization/Workspace/Brand authorization representation, grant authority, or inheritance
rule. Capability match alone is explicitly insufficient. Schema mutation is paused until the Owner
selects the bounded policy recorded in `REVIEW.md`.

## Acceptance

The full acceptance set is the current Owner P3 master implementation prompt. Technical completion
must include fresh targeted, race, durability, migration, P1/P2 regression, full test, build,
typecheck-delta, diff, commit, push, and remote-ref evidence. Canonicalization remains a later Owner
gate. DONE means stop; P4 must not start.
