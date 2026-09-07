# ADR-0004: P5 Agent Control Contract

## Status

APPROVED

Approved by the Owner through P5-G1R1 on 2026-09-08. Approval freezes the P5 V1 contract and opens the P5-G2 entry gate only after the corrective gate is remote-verified and strictly fast-forwarded into the P5 phase branch. It does not authorize implementation in G1R1.

## Context

P5 must turn opaque P3/P4 semantic references into historically auditable AgentRun governance without collapsing human RBAC, tenant authority, Agent operating policy, context authority, tool permission, Worker capability, Worker tenant grant, approval, or lease. The Technical Package defines the phase objective and major boundaries but does not fully specify identity/version lifecycle, AgentRole semantics, permission composition, context snapshots, instruction precedence, concrete autonomy limits, or revalidation.

The original P5-G1 recovered this boundary and correctly stopped before schema/runtime mutation. These missing choices alter permission semantics, trust boundaries, and public lifecycle rules, so Owner approval and one durable ADR are required.

## Decision

- Use `AgentDefinition` as stable semantic Agent identity and immutable published `AgentDefinitionVersion` as execution identity. Definition parents are `ACTIVE`, `SUSPENDED`, or `ARCHIVED`; versions are mutable/non-executable `DRAFT`, immutable/executable `PUBLISHED`, or immutable/historical `RETIRED`.
- Use stable `AgentRole` plus immutable `AgentRoleVersion`. One Run binds exactly one role version through `roleRef`. AgentRole is not P2 human RBAC. P5 V1 has no role inheritance, composition, or simultaneous multiple roles.
- Give each definition and role exactly one platform, Organization, Workspace, or Brand owner scope. Ancestor-owned artifacts may be applicable to descendant Runs, but applicability never grants tenant or human authority. Cross-Organization and sibling applicability are denied.
- Compile permission from deny by default and intersection only. An applicable explicit deny or missing required authority denies. The authenticated initiator's P2 authority is a hard ceiling; definition, role, or autonomy cannot create delegated authority.
- Bind every Run to one immutable, expiring, canonical-hashed final `PermissionManifest` containing exact scope, definition/role references, policy revision hash, and scoped grants with tool/action/resource/human-capability/approval/constraint semantics. P6 will later map opaque `toolRef` values to concrete tools.
- Compile exact-scope context into an immutable `ContextPackage` snapshot or content-addressed immutable reference set. Descendant aggregation is explicit, enumerated, authorized per scope, allowed by definition/role/policy, and evidenced. Required-source failure rejects compilation; optional exclusion is recorded. Raw secrets never enter context evidence.
- Fix instruction precedence as non-prompt Constitution/Owner/P2/P3/P4 enforcement, then platform policy, Organization-to-Workspace-to-Brand policy, definition instructions, role instructions, and task instructions. Retrieved context and tool output are structurally data only.
- Bind a concrete `RunBudget`. Defaults are 24 steps, 48 tool calls, 900 seconds, 64,000 context tokens, 2 concurrent Runs per Organization, 1 retry, no nested Runs, and 86,400 seconds approval wait. Hard ceilings are respectively 64, 128, 1,800, 128,000, 4, 2, false, and 172,800. Every layer may only lower limits.
- Preserve exact definition version, role version, context, manifest, budget, initiator provenance, and tenant ancestry for the life of one Run. Retry and approval resume reuse these artifacts; they do not silently recompile.
- Revalidate current policy and initiator authority before execution, after approval resume, before retry, and before every policy write or gated action. Restrictive change/revocation denies future authority. Permissive change never widens the original manifest. Wider authority or fresher context requires a new Run.
- Keep P3 as the sole durable AgentRun/ApprovalRequest owner. Keep P4 as the sole Worker identity/grant/capability/lease/local-runtime/Codex boundary. Keep P6 tool and MCP implementation deferred.

The detailed fields, action classes, aggregation tests, budget table, threat closures, and falsifiers are normative in `.piltover/handoffs/PIL-WO-20260908-008-agent-control-plane/P5_CANONICAL_CONTRACT_FREEZE.md`.

## Alternatives considered

- A separate stable `Agent` above `AgentDefinition`: rejected for V1 because it has no proven consumer and adds identity ambiguity.
- Reuse P2 human roles as AgentRole: rejected because administrative/request authority is not an Agent operating persona or Run permission.
- Role inheritance/composition or permission union: rejected because a V1 privilege lattice creates hard-to-audit escalation paths; intersection and one role are sufficient.
- Live context references and artifact recompilation on retry/resume: rejected because later mutation would change historical Run meaning and could widen authority.
- Prompt-only defenses for retrieved instruction injection: rejected because prompts are not an authorization boundary; representation and server enforcement must separate data from instruction.
- Vague autonomy levels: rejected because they cannot be enforced or audited without concrete limits.
- P5-owned approval or direct Codex execution: rejected because they duplicate/bypass canonical P3/P4 authority.

## Consequences

- Historical Runs can identify the exact immutable definition, role, context, permission, policy revision, budget, initiator, and tenant ancestry used.
- Authority is monotonic during one Run: it may stay the same or narrow, never silently widen.
- Tenant safety requires explicit enumeration and authorization for every aggregated descendant, which is more verbose but auditable.
- Policy revocation can stop future steps, retries, or resumes even though original artifacts remain immutable evidence.
- A more permissive policy or fresh data requires a new Run, avoiding semantic mutation but increasing Run creation.
- P5-G2 may require additive shared-contract and schema fields; P4 may transport opaque refs but does not interpret P5 semantics.
- The V1 model intentionally defers role lattices, nested/multi-agent runs, concrete tool catalogs, MCP, and generalized policy engines.

## Migration and reversal plan

G1R1 changes documentation only. P5-G2 must propose additive schema/shared-contract changes with migrations, tests, and compatibility review before implementation. Existing P3/P4 opaque references remain valid seams until then.

Before runtime adoption, this ADR may be superseded by a new Owner-approved ADR without data migration. After adoption, changes must use new immutable versions and forward migrations; they must not reinterpret historical Runs or mutate published artifacts. Disable new Run compilation to halt adoption while preserving P3/P4 durable history.

## Owner gate

The P5-G1R1 Master Prompt is explicit Owner approval of these seven consequential contract groups. It authorizes this contract/ADR evidence, remote corrective-gate publication, and strict fast-forward integration of the resolved G1 lineage into the P5 phase branch. It does not authorize P5 runtime/schema implementation, P5-G2 execution, P6, deployment, production migration, or master mutation.

## References and evidence

- `.piltover/handoffs/PIL-WO-20260908-008-agent-control-plane/P5_CANONICAL_CONTRACT_FREEZE.md`
- `.piltover/handoffs/PIL-WO-20260908-008-agent-control-plane/REVIEW.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/01_GOVERNANCE/TECHNICAL_CONSTITUTION.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/01_GOVERNANCE/OWNER_GATES.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/01_GOVERNANCE/CHANGE_AND_ADR_POLICY.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/05_AGENT_CONTROL/AGENT_CONTROL_PLANE.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/05_AGENT_CONTROL/CONTEXT_COMPILER.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/05_AGENT_CONTROL/AUTONOMY_AND_APPROVAL.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/06_CODEX_BRIDGE/BRIDGE_SPEC.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/07_MCP/MCP_PERMISSION_MODEL.md`
- `docs/adr/0001-p2-tenancy-rbac-contract.md`
- `docs/adr/0002-worker-tenant-authorization.md`
- `docs/adr/0003-p4-worker-machine-auth-and-transport.md`
