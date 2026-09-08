# PIL-WO-20260908-008-agent-control-plane — P5 Agent Control Plane

Status: IN_PROGRESS
Phase: P5
Gate: P5-G2
Base ref expected: `aa1ed10b4b94b08c7f142e2e28841b4754d7bf39`

## Objective

Recover the canonical P5 Agent Control Plane contract from the Owner Technical Package, map it against the canonical P3/P4 implementation, and freeze the minimum sufficient Owner-approved V1 contract before any P5 schema or runtime mutation. G1R1 resolves the seven consequential gaps surfaced by the original G1 without erasing that fail-closed history.

## Why Now

P4 is canonical and the P5 entry gate is open. P5 cannot safely implement role resolution, context compilation, permission manifests, or autonomy controls until their identities, tenant boundaries, precedence, versioning, and downstream enforcement responsibilities are explicit.

## Read Set

- `AGENTS.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/00_META/SOURCE_OF_TRUTH.md`
- Technical Package governance, architecture, P5 domain/data, all of `05_AGENT_CONTROL/`, the bounded P4 bridge subset, relevant quality specifications, and the actual P5 phase file
- Canonical P3/P4 control-plane contracts, ports, Prisma models, approval implementation, tenant authorization, execution envelope, queue, events, and reconnect logic

## Constraints

- Technical Package is normative when it resolves a P5 contract.
- Fail closed when a consequential P5 contract is absent or contradictory.
- Preserve human RBAC, agent role, context authority, run permission, worker capability, worker tenant grant, lease, and approval as separate authorities.
- Documentation and architecture evidence only; no schema, migration, route, dependency, P4, UI, deployment, or runtime implementation change.
- All tracked artifacts are English.
- The Owner decision in P5-G1R1 is authoritative for the seven previously unresolved contract groups.
- No implementation begins in this gate; P5-G2 remains a separate gate.

## Acceptance Criteria

- [x] P4 canonical preflight is proven from remote Git and canonical status evidence.
- [x] The P5 phase and P5-G1 gate branches are created remotely from the exact P4 closeout SHA before contract work.
- [x] The actual P5 phase specification is located and its objective is extracted.
- [x] Package-resolved P5/P3/P4 boundaries and invariants are documented.
- [x] Core entities, identity, tenancy, context, permission, approval, versioning, autonomy, and execution handoff are assessed against canonical evidence.
- [x] Critical threats and future falsifiers are mapped.
- [x] Consequential gaps are consolidated into one Owner Contract Gate.
- [x] The Owner Contract Gate resolves identity/versioning, role, permission, context, instruction, autonomy, and run-binding semantics.
- [x] ADR-0004 records the approved trust-boundary decision without duplicating the complete freeze.
- [x] G1R1 is published and strictly fast-forwarded into the P5 phase branch after proportional verification.
- [ ] P5 implementation is authorized. This is intentionally false in G1.

## Required Verification

- Exact local, tracking, and live remote SHA checks
- JSON parsing for `CONTEXT.json` and `STATUS.json`
- Artifact/path and documentation-only scope audit
- `git diff --check`
- Changed-artifact secret scan
- Review of P5/P4 authority separation and P6+ scope exclusion

## Mutation / Risk Class

G0 analysis plus reversible internal documentation. The unresolved policy choices require an Owner decision before G2-like permission/governance implementation.

## Out of Scope

- P5 schema or runtime implementation
- P4 protocol or implementation changes
- P6 MCP implementation or later-phase domain features
- UI, deployment, infrastructure, or dependency changes

## P5-G2 — Definition and Role Registry Foundation

Implement the minimum persistent and internal-service foundation for stable `AgentDefinition` and `AgentRole` identities plus immutable version histories. The gate must enforce exact owner ancestry, parent/version lifecycle, one atomic current publication, deterministic hashes, historical exact-version reads, P2-governed mutation, and safe audit evidence.

G2 remains limited to the registry foundation. Context compilation, permission compilation, RunBudget enforcement, P3 AgentRun binding, P4/Codex changes, P6 tools, public routes, UI, deployment, and production migration remain outside this request.
