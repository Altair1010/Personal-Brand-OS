# P5 Canonical Contract Freeze

## Status

OWNER_DECISION_REQUIRED

The Technical Package is authoritative for the contracts it states. This artifact freezes those resolved contracts and marks consequential omissions explicitly. It does not authorize schema or runtime implementation.

## Canonical Sources

- `00_META/SOURCE_OF_TRUTH.md` — product and repository authority
- `00_META/DECISION_LOG.md` — locked autonomy, tenancy, worker, Codex, MCP, and modular-monolith decisions
- `01_GOVERNANCE/TECHNICAL_CONSTITUTION.md` — canonical truth, fail-closed boundaries, context minimization, primary AI path, and Owner supremacy
- `01_GOVERNANCE/OWNER_GATES.md` — action classes and payload-bound approval object
- `01_GOVERNANCE/CHANGE_AND_ADR_POLICY.md` — ADR threshold for auth, permission, protocol, and trust-boundary decisions
- `02_ARCHITECTURE/SYSTEM_ARCHITECTURE.md`, `MODULE_BOUNDARIES.md`, `PORTS_AND_ADAPTERS.md`, `RUNTIME_TOPOLOGY.md`, and `STATE_AND_EVENT_MODEL.md` — plane ownership, module ownership, ports, no-VPS runtime, and run states
- `03_DOMAIN/DOMAIN_MODEL.md`, `TENANCY_AND_RBAC.md`, and `WORK_MODEL.md` — conceptual agent graph, tenant hierarchy, human RBAC, and work scope
- `04_DATA/TARGET_SCHEMA.md` and `TARGET_DATA_ARCHITECTURE.md` — conceptual P5 persistence candidates and canonical SQL rules
- `05_AGENT_CONTROL/AGENT_CONTROL_PLANE.md`, `CONTEXT_COMPILER.md`, `AUTONOMY_AND_APPROVAL.md`, and `STEWARD_INSPECTOR_DEV.md` — P5 flow, persisted references, minimum context, action classes, and proposal boundaries
- `06_CODEX_BRIDGE/BRIDGE_SPEC.md`, `PERSONAL_CODEX_WORKER.md`, `JOB_LEASE_AND_RECONNECT.md`, and `CODEX_RUNTIME_ADAPTER.md` — downstream P4 boundary
- `07_MCP/MCP_PERMISSION_MODEL.md` and `MCP_SERVER_SPEC.md` — future consumer evidence for deny-by-default run manifests and approval-aware tools; not authorization to implement P6
- `10_QUALITY/ERROR_TAXONOMY.md`, `OBSERVABILITY.md`, `SECURITY_MODEL.md`, and `TEST_STRATEGY.md` — stable errors, trace/audit, trust boundaries, and critical tests
- `12_PHASES/P5_AGENT_CONTROL_PLANE.md` — actual canonical P5 phase specification
- `schemas/run-request.schema.json`, `run-event.schema.json`, `run-result.schema.json`, and `approval.schema.json` — transport-independent P3/P4 references already reserved for P5

## P5 Objective

The package defines P5 as production-grade run governance delivering roles and definition versions, context package hashing/versioning, tool permission manifests, run traces, budgets/concurrency, retry policy, approval pause/resume, proposal patterns, and AgentRun diagnostics. It expressly forbids autonomous canonical Brand or Strategy mutation.

## Boundary

### P4

P4 owns machine authentication, exact Worker tenant grants, Worker capabilities, lease authority, outbound Worker transport, local repository alias resolution, and the Codex Runtime adapter. P4 accepts opaque `roleRef`, `contextRef`, and `permissionManifestRef` values and must not interpret them as tenant authority.

### P5

P5 owns semantic resolution before execution: selecting the exact agent definition version, resolving the operating role, compiling authorized minimum context, compiling least-privilege run permission, determining approval requirements, and binding exact artifacts to the canonical run.

### Later Phases

P6 exposes scoped Piltover tools through MCP and enforces both human RBAC and the P5 run manifest. P7+ domain migration, intelligence, integrations, learning, UI, marketplaces, multi-agent orchestration, and deployment are deferred. P5 must not call Codex directly or implement a generic tool broker.

## Package-Supported System Graph

```text
                    AUTHENTICATED INITIATOR
                              |
                              v
                     TENANT-SAFE TASK/RUN
                              |
                              v
                        ROLE RESOLVER
                              |
                              v
                 AGENT DEFINITION VERSION REF
                              |
                              v
                      CONTEXT COMPILER
                  minimum + scoped + hashed
                              |
                              v
                 TOOL PERMISSION MANIFEST
                  deny by default + scoped
                              |
                              v
                   APPROVAL CLASSIFICATION
                              |
                              v
                  P3 AgentRun / ApprovalRequest
                              |
                              v
                   P3 Job + current lease
                              |
                              v
                P4 authenticated exact Worker
                              |
                              v
                 P4 CodexRuntimePort adapter
                              |
                              v
                            CODEX
```

The package does not name a persisted `ResolvedExecutionPlan`. The minimum safe interpretation is that the immutable references already carried by `RunRequest` and persisted by `AgentRun` collectively materialize the resolved plan. Naming a new aggregate is deferred until the Owner decisions below are resolved.

## Core Entities

| Entity | Canonical evidence | P5 need now | Freeze state |
|---|---|---:|---|
| AgentRole | Domain graph, P5 phase, agent-control flow | Yes | Semantics incomplete |
| AgentDefinitionVersion | Domain graph, P5 phase, persisted run references | Yes | Stable parent identity/ownership incomplete |
| AgentRun | Existing P3 durable model | Existing | P3-owned; P5 binds semantic artifacts before creation |
| ContextPackage | Context Compiler and `contextRef {id, hash}` | Yes | Authority/snapshot semantics incomplete |
| Tool Permission Manifest | P5 phase, MCP permission model, `permissionManifestRef` | Yes | Shape/composition/staleness incomplete |
| AgentStep | Target schema and trace requirement | Consumer exists in diagnostics | Persistence boundary not specified |
| ToolCall | Target schema and trace/audit requirement | Consumer exists in enforcement/diagnostics | Persistence boundary not specified |
| RunArtifact | Target schema and RunResult refs | Consumer exists | P5 ownership/retention not specified |
| RoleBinding | Only human RBAC bindings are defined | Unproven for AgentRole | Defer; do not reuse P2 bindings by assumption |
| AgentDefinition | Not a named package entity | Unproven | Do not invent until Owner defines stable identity model |

## Identity Model

- `requestedBy` is the authenticated human identity provenance and is governed by P2 server-side RBAC.
- AgentRole is a logical operating role, not the P2 human `OWNER/ADMIN/...` role set.
- AgentDefinitionVersion identifies the configuration executed by the AgentRun.
- Worker identity identifies the machine executing the run and confers no semantic agent permission.
- Canonical invariant: a historical run records exact configuration identity/version references, relevant prompt/skill hash, context hash, permission manifest reference, Worker, and runtime protocol version.

Unresolved: the package does not define a stable Agent or AgentDefinition identity distinct from `AgentDefinitionVersion`; version lifecycle/immutability rules; ownership; activation/retirement; or whether `roleRef` identifies a role version, a definition version, or a composed binding.

## Tenancy

The canonical tenant hierarchy is Platform → Organization → Workspace → Brand. Tenant-bound reads/writes fail closed on unknown scope, and Brand A context may never enter Brand B merely because one user can access both. `AgentRun` already carries Organization, optional Workspace, and optional Brand ancestry.

Unresolved: the package does not state whether AgentRole and AgentDefinitionVersion are global, Organization-owned, Workspace-owned, Brand-owned, or mixed; whether a Workspace run may aggregate child Brand data; or whether AgentRole inheritance/composition exists.

## Context Compiler

### Inputs fixed by source

- RunRequest and task intent
- exact Organization/Workspace/Brand scope
- resolved AgentRole/definition configuration
- requested/required data classes
- RBAC and tool policy
- freshness/confidence inputs
- context budget and prioritization

### Output fixed by source

A bounded minimum-sufficient ContextPackage with a stable ID and hash/version reference. It excludes unrelated Brands, bulk historical material, entire reference libraries, and arbitrary trace history. It has no independent mutation authority.

### Authority

Existence is not authority. Every included object must belong to the resolved run scope and be readable under server-side authorization. Cross-Organization, sibling Workspace, and sibling Brand inclusion fail closed.

### Immutability and Freshness

The exact compiled result used by a historical run must remain auditable by ID and hash. Freshness/confidence filters apply before compilation.

Unresolved: source snapshot versus live-reference semantics; retention/reconstruction guarantees; secret classes and redaction; explicit child aggregation policy; exact handling when a referenced source changes or disappears; and whether authorization failure excludes one item or rejects the whole compilation.

## Permission Compiler

### Fixed composition constraints

- Start from deny by default.
- Scope every permission to Organization/Workspace/Brand.
- A tool permission cannot bypass human approval.
- Expired or cancelled runs lose write authority.
- All writes carry run and audit correlation.
- Human RBAC, run permission, Worker capability, Worker tenant grant, and lease are independent required checks.
- A higher-level explicit deny cannot safely be widened by a lower-level allow under the Constitution's fail-closed rule.

### Required conceptual intersection

```text
effective run authority
  = tenant-valid operation
  AND initiator-authorized request
  AND agent-definition requirement
  AND agent-role policy
  AND tenant/platform policy
  AND explicit run manifest allow
  AND approval state when required
  AND Worker capability
  AND exact Worker tenant grant
  AND current lease
  AND P4 local/runtime constraints
```

This is a safety lower bound inferred from multiple canonical constraints, not a package-defined precedence algorithm. The exact compiler must not be implemented until its unresolved ordering and conflict rules are approved.

Unresolved: manifest schema; resource/filesystem/network/Git/external-mutation fields; expiry; fingerprint/version; initiator ceiling; role composition; conflict precedence beyond deny-by-default; cache invalidation; and stale-manifest revalidation.

## Approval Integration

P5 classifies an intended action as automatic, reversible policy-based write, or gated. P3 remains the only durable ApprovalRequest store and state machine. Approvals bind action, target, payload hash/version, requester, approver, expiry, and one-time identifier. P4 may proceed only while run, approval, Worker, grant, capability, and lease authority remain valid.

Unresolved: whether an approved run resumes against its original immutable manifest or must recompile/revalidate current policy; which actions require one-time consumption; and how standing policies are versioned and bound.

## P4 Execution Handoff

P5 should populate the existing P3 `RunRequest` references rather than introduce raw Codex instructions or P4 protocol churn:

- exact tenant ancestry
- `roleRef`
- task
- `contextRef { id, hash }`
- `permissionManifestRef`
- required Worker capabilities
- idempotency/correlation material

P3 persists these fields and owns queue/run/approval state. P4 produces an execution envelope only for an authenticated active Worker with an exact active tenant grant, required capabilities, and current lease. P5 cannot select a local path, executable, environment, raw shell, raw JSON-RPC method, or bypass `CodexRuntimePort`.

## Instruction Precedence

The package establishes that retrieved/user/domain content cannot override the Technical Constitution, Owner gates, tenant authorization, run permission, or P4 enforcement. It does not define a complete prompt assembly precedence among system policy, Agent definition, Agent Role, task instruction, retrieved context, and tool output.

Safe unresolved graph:

```text
OWNER / CONSTITUTION / SERVER ENFORCEMENT
                   |
                   v
       package-approved system policy
                   |
              [GAP: order]
          +--------+--------+
          |                 |
 Agent definition      Agent role
          +--------+--------+
                   |
              task instruction
                   |
       retrieved context [DATA]
                   |
            tool output [DATA]
```

Until the Owner freezes the middle ordering and override rules, retrieved context and tool output are data only and no runtime prompt compiler may be implemented.

## State / Versioning

- AgentRun state remains the existing explicit P3 state machine.
- Approval state remains the existing P3 state machine.
- Configuration references and context/permission fingerprints must be persisted per run.
- Historical meaning cannot follow a mutable `latest` definition, role, context, or permission object.
- Policy-based retries must retain idempotency and cannot silently widen authority.

Unresolved: definition/role draft-active-retired lifecycle, semantic version identity, immutable content storage, permission invalidation, and whether retries reuse or recompile artifacts after policy change.

## Threat Model

| Threat | Attack path | Failed invariant | Canonical control | P5 owner | Downstream owner | Required falsifier |
|---|---|---|---|---|---|---|
| Cross-tenant context leak | Run A references resource B | Context matches exact tenant | Exact ancestry, server RBAC, minimum graph | Context Compiler | P2 tenant guard | A/B and sibling-scope denial |
| Role privilege escalation | Local AgentRole implies global admin | AgentRole is not human RBAC | P2 capability check plus separate run policy | Role/Permission Resolver | P2 | Agent role cannot grant absent human authority |
| Definition mutation after run | Mutable latest rewrites history | Exact historical configuration | Version references and hashes | Definition registry | P3 run evidence | Edit active definition; old run fingerprint unchanged |
| Permission union escalation | One allow widens another deny | Least privilege | Deny-by-default, fail closed | Permission Compiler | P6 tool enforcement/P4 boundary | Organization deny plus role allow remains denied |
| Prompt-injection override | Retrieved text claims system authority | Data cannot become policy | Server enforcement and context minimization | Instruction/Context compiler | Tool adapter | Malicious context cannot alter manifest/approval |
| Stale manifest | Policy revoked after compile | Current authority cannot silently widen | Explicit states and fail closed | Permission lifecycle | P3/P6 | Revocation before tool call denies future mutation |
| Unauthorized tool call | Model emits unlisted tool | Manifest allowlist required | Deny-by-default manifest | Permission Compiler | P6 | Unknown/unlisted tool denied and audited |
| Approval bypass | Tool mutates without valid decision | Consequential action is gated | Payload-bound P3 approval | Policy classifier | P3/P6 | Missing/expired/mismatched/replayed approval denied |
| Capability confused with permission | Capable Worker executes denied tool | Capability is not permission | Independent checks | Permission Compiler | P4/P6 | Capability present plus manifest deny yields deny |
| Human authority confused with AgentRole | Launcher delegates excess authority | Agent never exceeds authorized initiation | P2/P5 separation | Resolver/Compiler | P2 | `agent.run` cannot produce unheld mutation right |
| Unbounded autonomy | Retry/tool loop consumes indefinitely | Execution is bounded | P5 budgets/concurrency/retry objective | Budget policy | P3/P4 runtime | Step/tool/time/retry limit terminates safely |
| P4 bypass | P5 calls Codex/local path directly | P4 remains execution boundary | CodexRuntimePort and Worker protocol | P5 handoff | P4 | No P5 dependency on adapter/JSON-RPC/local paths |

## Falsifier Matrix

| Contract | Future falsifier |
|---|---|
| Historical identity | A definition update cannot change an existing run's definition content/hash |
| Tenant ownership | Organization A role/definition/context/manifest cannot bind to Organization B run |
| Workspace isolation | Workspace A cannot aggregate sibling Workspace B context |
| Brand isolation | Brand A cannot include sibling Brand B context even for a dual-authorized user |
| Context minimality | Unrequested and unauthorized data classes are absent from the compiled package |
| Permission intersection | Any required deny or missing authority keeps the action denied |
| Initiator ceiling | A human with only `agent.run` cannot compile canonical mutation authority |
| Capability separation | Manifest allow plus missing Worker capability cannot execute |
| Approval binding | Changed payload, target, action, expiry, or consumed nonce cannot resume execution |
| Stale policy | Revoked policy before a consequential tool call denies that call |
| Prompt injection | Context/tool text cannot alter instruction tier, permission, or approval state |
| Bounded autonomy | Steps, tool calls, duration, retries, concurrency, and approval wait terminate at fixed limits |
| P4 boundary | Resolved plans cannot name raw executable, local absolute path, environment secret, or raw Codex RPC |
| Retry safety | Retry cannot widen context/permission or duplicate a non-idempotent effect |

## Deferred Scope

- Physical schema, migrations, repositories, routes, services, and runtime implementation
- P6 MCP server and final tool catalog compatibility decisions
- Domain-specific Marketing agents and P7+ business logic
- RAG/vector infrastructure, memory platform, self-learning, marketplaces, multi-agent orchestration, external channels, UI, deployment, and paid-model adapters
- Cache implementation; only invalidation requirements may be frozen after policy inputs are known

## Open Questions

### OWNER GATE — P5 CANONICAL CONTRACT

One consolidated Owner decision is required. The Owner should approve an explicit answer to each group, or provide a revised canonical package section that answers it.

1. **Agent identity and ownership** — Is the stable object `AgentDefinition` with immutable `AgentDefinitionVersion`, or is the version itself the only identity? Which levels may own definitions (platform, Organization, Workspace, Brand), and what are the draft/active/retired rules?
2. **Agent Role model** — Which tenant levels own AgentRole, may roles inherit or compose, how are conflicts and explicit denies resolved, are roles versioned, and what object does `roleRef` identify? Confirm that P2 human RBAC bindings are not reused as AgentRole bindings.
3. **Permission composition and initiator ceiling** — Freeze the ordered inputs, deny precedence, manifest schema/fingerprint/expiry, resource scopes, and the rule that compiled authority is never broader than the authenticated initiator's authority for the requested operation.
4. **Context authority and immutability** — Freeze allowed source ownership, child/ancestor aggregation rules, snapshot versus live-reference behavior, retention/reconstruction, secret classification/redaction, and whole-compile versus item-exclusion failure behavior.
5. **Instruction precedence** — Freeze the exact order and override rules for platform/system policy, Agent definition, Agent Role, task instruction, retrieved context, and tool output; explicitly classify retrieved content/tool output as untrusted data unless a separately authorized instruction source says otherwise.
6. **Autonomy and limits** — Define executable meanings and owners for step count, tool calls, runtime, token/context budget, concurrency, retries, nested runs, and approval wait. Named autonomy levels, if used, must map to these concrete limits and mutation/approval classes.
7. **Run binding and revalidation** — Decide what exact immutable references P3 stores, whether approval resume/retry reuses the original artifacts or recompiles current policy, and which policy changes invalidate an unstarted or paused manifest.

No ADR is created in G1 because these are unresolved Owner decisions rather than architecture decisions already made by this gate. After approval, ADR policy requires a durable record for any newly selected permission, auth, protocol, or trust-boundary semantics not already added to the canonical package.
