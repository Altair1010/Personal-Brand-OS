# P5 Canonical Contract Freeze

## Status

APPROVED

The Technical Package remains authoritative for the contracts it states. P5-G1 correctly stopped at `OWNER_DECISION_REQUIRED`; the Owner decision in P5-G1R1 resolves the seven consequential omissions and approves this minimum sufficient P5 V1 governance contract. This artifact authorizes later gated design and implementation, not schema or runtime mutation in G1R1.

## Owner Contract Resolution R1

The Owner approves the complete P5 V1 contract recorded below: minimum sufficient Agent governance that is tenant-safe, historically auditable, deny-by-default, immutable per Run, concretely bounded, monotonic in authority, compatible with P3/P4, and evolvable without weakening prior truth. The resolution closes the seven questions preserved in the final historical section; it does not retroactively make the original blocked G1 a passing gate by itself.

## Canonical Sources

- `00_META/SOURCE_OF_TRUTH.md` and `00_META/DECISION_LOG.md`
- `01_GOVERNANCE/TECHNICAL_CONSTITUTION.md`, `OWNER_GATES.md`, and `CHANGE_AND_ADR_POLICY.md`
- `02_ARCHITECTURE/SYSTEM_ARCHITECTURE.md`, `MODULE_BOUNDARIES.md`, `PORTS_AND_ADAPTERS.md`, `RUNTIME_TOPOLOGY.md`, and `STATE_AND_EVENT_MODEL.md`
- `03_DOMAIN/DOMAIN_MODEL.md`, `TENANCY_AND_RBAC.md`, and `WORK_MODEL.md`
- `04_DATA/TARGET_SCHEMA.md` and `TARGET_DATA_ARCHITECTURE.md`
- `05_AGENT_CONTROL/AGENT_CONTROL_PLANE.md`, `CONTEXT_COMPILER.md`, `AUTONOMY_AND_APPROVAL.md`, and `STEWARD_INSPECTOR_DEV.md`
- `06_CODEX_BRIDGE/BRIDGE_SPEC.md`, `PERSONAL_CODEX_WORKER.md`, `JOB_LEASE_AND_RECONNECT.md`, and `CODEX_RUNTIME_ADAPTER.md`
- `07_MCP/MCP_PERMISSION_MODEL.md` and `MCP_SERVER_SPEC.md` as future-consumer evidence only
- `10_QUALITY/ERROR_TAXONOMY.md`, `OBSERVABILITY.md`, `SECURITY_MODEL.md`, and `TEST_STRATEGY.md`
- `12_PHASES/P5_AGENT_CONTROL_PLANE.md`
- `schemas/run-request.schema.json`, `run-event.schema.json`, `run-result.schema.json`, and `approval.schema.json`
- Owner-approved P5-G1R1 contract resolution dated 2026-09-08
- `docs/adr/0004-p5-agent-control-contract.md`

## P5 Objective

P5 provides minimum sufficient, production-grade AgentRun governance: immutable agent and role versions, tenant-safe context compilation, deny-by-default permission manifests, concrete budgets, durable approval integration, monotonic revalidation, run traces, and exact historical evidence. It does not authorize autonomous canonical Brand/Strategy mutation or create a generalized enterprise policy language.

## Boundary

### P3

P3 remains canonical for durable `AgentRun`, Job, retry, lease-related run truth, and the single durable `ApprovalRequest` lifecycle. P5 classifies and binds semantic authority; it does not create a second approval store.

### P4

P4 remains sole owner of Worker machine identity, exact Worker tenant grants, Worker capabilities, current lease enforcement, outbound Worker transport, local repository alias resolution, `CodexRuntimePort`, and the App Server process. P5 cannot select local paths, executables, shell commands, environment secrets, Worker credentials, or raw Codex JSON-RPC methods, and cannot call Codex directly.

### P5

P5 resolves the exact `AgentDefinitionVersion` and `AgentRoleVersion`, compiles the immutable authorized minimum `ContextPackage`, compiles the immutable least-privilege `PermissionManifest`, binds the concrete `RunBudget`, classifies approvals, and supplies opaque semantic references to P3/P4.

### P6 and Later

P6 maps stable `toolRef`, action, resource scope, approval class, and constraints to actual Piltover/MCP tools. P5 does not implement MCP, a marketplace, plugin registry, or generic tool broker. Domain agents, multi-agent orchestration, memory/RAG platforms, UI, deployment, and other later-phase features remain deferred.

## Approved System Graph

```text
                    AUTHENTICATED INITIATOR
                              |
                    P2 AUTHORITY CEILING
                              |
                              v
                     TENANT-SAFE RUN TASK
                              |
                              v
                 ONE AGENT ROLE VERSION
                              |
                              v
               ONE AGENT DEFINITION VERSION
                              |
                              v
                      CONTEXT COMPILER
                exact scope + explicit inputs
                              |
                              v
                    CONTEXT PACKAGE
               immutable snapshot + content hash
                              |
                              v
                   PERMISSION COMPILER
            deny by default + intersection only
                              |
                              v
                  PERMISSION MANIFEST
                 immutable authority ceiling
                              |
                              v
                   APPROVAL CLASSIFICATION
                              |
                              v
                 P3 AgentRun / ApprovalRequest
                              |
                              v
                 P4 Worker + lease + runtime
                              |
                              v
                            CODEX
```

## Core Entities

| Entity | Stable meaning | P5 V1 rule |
|---|---|---|
| `AgentDefinition` | Stable semantic Agent identity | Exactly one owner scope; `ACTIVE`, `SUSPENDED`, or `ARCHIVED` |
| `AgentDefinitionVersion` | Immutable execution identity | `DRAFT`, `PUBLISHED`, or `RETIRED`; only published is selectable/executable |
| `AgentRole` | Stable operating-role identity, distinct from human RBAC | Exactly one owner scope |
| `AgentRoleVersion` | Immutable Run operating constraints | One exact published version per Run; no inheritance/composition |
| `ContextPackage` | Exact compiled context used by a Run | Immutable snapshot/reference set with canonical content hash |
| `PermissionManifest` | Final compiled authority ceiling | Immutable, scoped, canonical-hashed, expiring grants |
| `RunBudget` | Concrete bounded autonomy | Immutable per Run; every layer may only lower limits |
| `AgentRun` | Durable canonical run | P3-owned; binds all exact semantic artifacts and provenance |
| `ApprovalRequest` | Durable consequential-action decision | P3-owned; exact action/target/payload bound |

No additional stable `Agent` entity exists in P5 V1. `AgentStep`, `ToolCall`, and `RunArtifact` remain consumer-driven implementation candidates; G1R1 does not decide their physical persistence.

## Identity Model

- Stable semantic Agent identity is `AgentDefinition`.
- Execution identity is one exact `AgentDefinitionVersion`.
- Requested human provenance, Agent Definition, Agent Role, Worker identity, and approver identity are separate principals/concepts.
- A historical Run remains pinned to exact immutable versions and compiled artifacts forever.
- Mutable `latest` resolution cannot reinterpret historical Runs.

`AgentDefinition` lifecycle is `ACTIVE`, `SUSPENDED`, or `ARCHIVED`. A suspended or archived definition cannot be selected for new Runs. Version lifecycle is:

- `DRAFT`: mutable and not executable.
- `PUBLISHED`: immutable and executable.
- `RETIRED`: immutable, historically readable, and not selectable for a new Run.

At most one current published version is selected by default for a definition. Explicit historical references remain immutable evidence, not a route around new-Run selection rules.

## Role Model

`AgentRole` describes how an Agent may operate in one Run context. It is not P2 `OWNER`, `ADMIN`, `EDITOR`, or `VIEWER`, and it does not reuse P2 `RoleBinding`. One Run binds exactly one `AgentRoleVersion`; `roleRef` means that version, not the stable parent and not an Agent Definition.

AgentRole versions use `DRAFT`, `PUBLISHED`, and `RETIRED` with the same mutability/executability rules as definition versions. P5 V1 has no role inheritance, role composition, or simultaneous multiple roles. Any later privilege lattice requires a separate ADR and cannot reinterpret existing Runs.

Agent Definition says what the Agent is designed to do. Agent Role says how it may operate. Either may request capabilities or narrow behavior, permission, or context; neither can grant human authority, tenant authority, Worker authority, or widen any higher boundary.

## Tenancy and Applicability

Each `AgentDefinition` and `AgentRole` has exactly one owner scope: `PLATFORM`, `ORGANIZATION`, `WORKSPACE`, or `BRAND`.

- Platform-owned artifacts may be applicable to any tenant Run.
- Organization-owned artifacts may apply to that Organization or its descendant Workspace/Brand Runs.
- Workspace-owned artifacts may apply to that Workspace or its descendant Brand Runs.
- Brand-owned artifacts apply only to that exact Brand.
- Cross-Organization and cross-sibling applicability is denied.

Applicability is not tenant authorization. A platform/ancestor artifact cannot make tenant data readable or manufacture a human/Worker grant.

## Context Compiler

### Inputs

- Exact tenant ancestry and Run/task request
- Exact `AgentDefinitionVersion` and `AgentRoleVersion`
- Explicit requested context sources and data classes
- Required/optional classification for every source
- P2 initiator read authority and tenant policy
- Freshness/version evidence and context-token budget

### Output

Every executable Run receives one immutable `ContextPackage`. Small structured material may be snapshotted by value; large material may be held through a content-addressed immutable artifact/reference. Both forms record source reference, source version/fingerprint where available, content hash, included scope, data class, and compilation timestamp. A later source change never mutates an existing Run.

Context required to explain a retained AgentRun cannot be deleted while that Run remains inside canonical audit retention. Physical long-term purge policy is deferred.

### Scope and Aggregation

The default data rule is exact Run scope only:

- Organization Run: Organization-scoped business data only.
- Workspace Run: exact Workspace business data only.
- Brand Run: exact Brand business data only.

Ancestor governance policy may constrain a Run but is not automatically imported business context. No implicit child, sibling, or ancestor business-data aggregation exists.

Organization or Workspace Runs may aggregate descendant data only when the task explicitly requires it, exact descendant IDs are enumerated, the initiator has read authority for every included scope, the definition allows the data class, the role allows aggregation, tenant policy permits it, and the ContextPackage records every included scope. There is no wildcard “all Brands I can access” without an explicit canonical selection policy. Brand Runs cannot aggregate sibling Brands; sibling Workspaces and cross-Organization context are denied.

### Required, Optional, Freshness, and Secrets

A required source authorization failure, missing source, invalid scope, or required freshness failure rejects the entire compilation. An optional source may be excluded only with a deterministic recorded reason.

Raw API keys, passwords, bearer credentials, private keys, Codex/OpenAI authentication material, and other secrets never enter a ContextPackage. A future tool may receive only an opaque authorized secret reference; actual resolution belongs to an approved secure tool/runtime boundary. Retrieved content cannot smuggle secret values into persisted context evidence.

## Permission Compiler

P5 begins from deny and computes intersection only. There is no permission union. For a candidate action every required condition is an `AND`:

```text
Platform / Constitution policy
  AND tenant policy
  AND authenticated initiator authority ceiling
  AND AgentDefinitionVersion constraints
  AND AgentRoleVersion constraints
  AND Run/task request
  AND PermissionManifest explicit grant
  AND P3 approval state when required
  AND P4 Worker capability
  AND P4 exact Worker tenant grant
  AND current lease
  AND P4 local/runtime constraints
  = executable action
```

Explicit deny at any applicable governance/policy level wins. Missing required authority denies. Organization policy constrains Workspace policy, which constrains Brand policy; a child may narrow or specialize but cannot widen an ancestor deny. Sibling policies never compose.

An AgentRun can never compile authority broader than the authenticated initiator possesses for the requested operation and exact target. P2 remains the human authority source. `agent.run` alone cannot become Strategy write, deployment, Git master mutation, credential administration, or another unheld capability.

## PermissionManifest V1

Every Run receives one immutable final manifest with:

- `id`
- exact Run/tenant scope
- `AgentDefinitionVersion` reference
- `AgentRoleVersion` reference
- `policyRevisionSetHash`
- `createdAt` and `expiresAt`
- canonical `contentHash`
- `grants[]`

Each final grant contains a stable/opaque `toolRef`, allowed actions, exact resource scopes, required human capability where applicable, approval class, and bounded constraints. The manifest contains final allowed authority, not competing allow/deny rules. Canonical serialization and hashing are mandatory. P6 owns the later concrete tool catalog and mapping.

## Action Classes and Approval Integration

P5 V1 has exactly three policy classes:

- `AUTOMATIC`: explicitly allowed read-only, non-mutating action.
- `POLICY_WRITE`: explicitly allowed, reversible/idempotent/auditable, exact-scope write within initiator and current policy ceilings, with no external commitment and no destructive/security-sensitive effect.
- `GATED`: durable P3 approval required. This includes destructive or non-reversible action, external commitment, canonical Git/master mutation, deployment/production mutation, security/permission change, credential/secret-sensitive action, and anything policy marks gated.

P3 is the single durable `ApprovalRequest` owner. Approval binds the original exact action, target, payload, requester/approver requirements, expiry, and consumption state. Changed payload requires a new approval. Approval never widens the immutable manifest.

## Instruction Precedence

```text
NON-PROMPT ENFORCEMENT
Constitution / Owner Gates / P2 / P3 / P4
                    |
                    v
PLATFORM SYSTEM POLICY
                    |
                    v
TENANT GOVERNANCE POLICY
Organization -> Workspace -> Brand
                    |
                    v
AgentDefinitionVersion instructions
                    |
                    v
AgentRoleVersion instructions
                    |
                    v
Run / Task instruction
                    |
                    v
Retrieved context = DATA
                    |
                    v
Tool output = DATA
```

A lower tier may specialize only within every higher-tier constraint. It cannot override a higher deny or hard policy. Retrieved content and tool output remain structurally separated data even if they contain phrases claiming system, administrator, or override authority. Prompt text cannot alter tenant authority, manifest, approval, Worker capability/grant, or lease.

## RunBudget V1

P5 V1 uses concrete enforceable limits, not vague `LOW`, `MEDIUM`, or `HIGH` labels.

| Limit | Default | Platform hard ceiling |
|---|---:|---:|
| `maxSteps` | 24 | 64 |
| `maxToolCalls` | 48 | 128 |
| `maxRuntimeSeconds` | 900 | 1800 |
| `maxContextTokens` | 64000 | 128000 |
| `maxConcurrentRunsPerOrganization` | 2 | 4 |
| `maxRetries` | 1 | 2 |
| `nestedRunsAllowed` | false | false |
| `maxApprovalWaitSeconds` | 86400 | 172800 |

The effective value is the minimum of platform ceiling, tenant policy, definition version, role version, request budget, and downstream runtime/model limit. Every layer may lower limits; none may raise a higher ceiling.

P5 owns step/tool/context limits, retry policy, Agent-level concurrency, and approval-wait policy. P3 remains durable run/job/retry truth. P4 enforces runtime/process timeout where applicable. The runtime/model may further lower context tokens. Nested and multi-agent Runs are prohibited in P5 V1.

## Immutable Run Binding

A canonical AgentRun must preserve:

- `agentDefinitionVersionRef`
- `roleRef` identifying `AgentRoleVersion`
- `contextRef { id, hash }`
- `permissionManifestRef` and `permissionManifestHash`
- `policyRevisionSetHash`
- immutable `RunBudget` or equivalent reference plus hash
- authenticated `requestedBy` provenance
- exact tenant ancestry

P5-G2 may add shared-contract/schema fields explicitly. P4 may transport new opaque references but does not interpret P5 semantics. Once created, the definition version, role version, context snapshot, permission manifest, and budget are frozen.

## Revalidation, Retry, and Resume

Revalidation occurs before execution begins, after approval resume, before retry execution, before every `POLICY_WRITE`, and before every `GATED` action. It compares current governing policy and initiator authority with the manifest policy revisions.

- More restrictive current policy or revoked initiator authority denies/invalidate future authority.
- More permissive current policy does not widen the original manifest.
- A retry in the same Run reuses exact definition, role, context, manifest, and budget.
- A stale/invalidated retry does not recompile; it returns `RUN_POLICY_STALE` or equivalent and requires a new Run for new compilation.
- Approval resume requires the original manifest, exact action/target/payload, valid unconsumed approval, current P2/approver requirements, current tenant policy, current Run state, and current downstream authority.
- Retries/resumes keep the same historical context snapshot. Fresh source data requires a new Run.

## Policy Monotonicity Law

During the life of one AgentRun, authority may stay the same or become narrower. It may never silently become wider. This applies to permission, context authority, tenant authority, approval, budget, and tool access. Wider authority or fresher context always requires a new Run.

## P4 Execution Handoff

P5 populates semantic references in the existing P3/P4 seam and may extend it additively in P5-G2. P3 persists them and owns run/queue/approval truth. P4 creates an execution envelope only for an authenticated active Worker with exact active tenant grant, required capabilities, and current lease. There is no P5-to-Codex path.

## Threat Model

| Threat | Approved closure | Required falsifier |
|---|---|---|
| Role escalation | AgentRole cannot exceed P2 initiator ceiling or tenant scope | `agent.run` cannot compile an unheld mutation capability |
| Cross-tenant context | Exact scope default; explicit enumerated descendant aggregation only | Organization/Workspace/Brand sibling and cross-Organization denials |
| Permission union | Intersection only; any deny/missing requirement denies | Role allow cannot override tenant/initiator deny |
| Prompt injection | Retrieved context/tool output are structurally data only | Injection text cannot alter manifest, approval, or authority |
| Stale manifest | Restrictive policy/current revocation denies future action | Revoke after compile, then deny start/retry/write/resume |
| Permissive policy change | Original manifest remains ceiling | Later allow does not widen existing Run |
| Approval bypass | `GATED` requires payload-bound durable P3 approval | Missing/expired/changed/consumed approval denies |
| Capability confusion | Worker capability is an independent downstream check | Manifest allow plus missing capability denies |
| Historical mutation | Published versions and compiled artifacts are immutable | Later edit cannot change old Run hashes/content |
| P4 bypass | P5 cannot name/runtime-invoke raw local/Codex mechanisms | Dependency and payload scans reject bypass fields/imports |
| Unbounded loop | Concrete RunBudget and no nested Runs | Every budget/timeout/concurrency boundary terminates safely |
| Secret disclosure | Raw secrets never enter context/manifest evidence | Secret fixtures are excluded and audited |

## Falsifier Matrix

| Contract | Future falsifier |
|---|---|
| Identity/version | Draft is non-executable; published is immutable; retired is not newly selectable; old Run remains exact |
| Artifact ownership | Platform/ancestor applicability never becomes tenant read authority |
| Role | Exactly one published `AgentRoleVersion`; inheritance/composition rejected |
| Context | Required failure rejects compilation; optional exclusion has deterministic evidence |
| Aggregation | No wildcard/sibling/cross-Organization aggregation; every descendant ID is proven |
| Secrets | Raw secret values never persist in context, manifest, audit, event, or trace |
| Permission | Every condition intersects; missing authority and explicit deny remain deny |
| Initiator | Human with only `agent.run` cannot compile Strategy write or other unheld capability |
| Instruction | Retrieved/tool text cannot change instruction tier or non-prompt controls |
| Approval | Exact action/target/payload/expiry/consumption is revalidated on resume |
| Budget | Default and hard ceilings are enforced; lower layers cannot raise them; nested Runs fail |
| Retry | Exact immutable artifacts are reused and stale restrictive policy returns explicit failure |
| Monotonicity | Permissive change cannot widen an existing Run; a new Run is required |
| P4 boundary | P5 payload cannot contain local path, executable, shell, secret, Worker credential, or raw RPC |

## Deferred Scope

- Physical schema, migrations, repositories, routes, services, and runtime implementation
- P6 MCP server, tool catalog, marketplace, plugin registry, and generic external tool broker
- Domain-specific agents and P7+ business logic
- Role inheritance/composition and simultaneous multi-role Runs
- Nested/multi-agent orchestration
- Long-term physical purge policy, cache implementation, RAG/vector infrastructure, self-learning, UI, deployment, and external channels

## Resolved Owner Questions

The original G1 asked seven consequential questions and correctly blocked. P5-G1R1 resolves them as follows:

1. **Agent identity and ownership:** `AgentDefinition` is stable identity, `AgentDefinitionVersion` is immutable execution identity, and ownership is exactly one platform/Organization/Workspace/Brand scope with ancestor-to-descendant applicability but no authority grant.
2. **Agent Role:** stable `AgentRole` plus immutable versions; `roleRef` is one `AgentRoleVersion`; no P2 binding reuse, inheritance, composition, or multiple roles in V1.
3. **Permission:** deny-by-default intersection with explicit-deny precedence, initiator ceiling, canonical-hashed expiring final manifest, exact resource grants, and no union.
4. **Context:** exact-scope immutable snapshot, explicit enumerated descendant aggregation, required/optional failure semantics, audit retention, and no raw secrets.
5. **Instruction:** non-prompt enforcement outranks platform, tenant, definition, role, and task instruction; retrieved context and tool output are data only.
6. **Autonomy:** the concrete default/hard-ceiling `RunBudget` above; each layer may only lower; nested Runs are prohibited.
7. **Run binding/revalidation:** exact artifacts and provenance are immutable per Run; retry/resume reuse them, restrictive current authority denies, and permissive change never widens.

No consequential Owner-contract blocker remains for P5-G2 design. G1R1 itself remains contract-only and must stop after verified phase integration.
