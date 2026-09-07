# PIL-WO-20260908-008-agent-control-plane — P5 Agent Control Plane Contract Freeze

Status: IN_PROGRESS
Phase: P5
Gate: P5-G1
Base ref expected: `aa1ed10b4b94b08c7f142e2e28841b4754d7bf39`

## Objective

Recover the canonical P5 Agent Control Plane contract from the Owner Technical Package, map it against the canonical P3/P4 implementation, freeze every package-resolved boundary, and surface one consolidated Owner gate for consequential gaps before any P5 schema or runtime mutation.

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
- One consolidated Owner gate rather than fragmented implementation questions.

## Acceptance Criteria

- [x] P4 canonical preflight is proven from remote Git and canonical status evidence.
- [x] The P5 phase and P5-G1 gate branches are created remotely from the exact P4 closeout SHA before contract work.
- [x] The actual P5 phase specification is located and its objective is extracted.
- [x] Package-resolved P5/P3/P4 boundaries and invariants are documented.
- [x] Core entities, identity, tenancy, context, permission, approval, versioning, autonomy, and execution handoff are assessed against canonical evidence.
- [x] Critical threats and future falsifiers are mapped.
- [x] Consequential gaps are consolidated into one Owner Contract Gate.
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
