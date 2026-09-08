# Result — PIL-WO-20260908-008-agent-control-plane

Status: IN_PROGRESS

## Git

- Canonical master and P5 phase base: `aa1ed10b4b94b08c7f142e2e28841b4754d7bf39`
- Original blocked G1: `gate/P5-G1-agent-control-plane-contract-freeze` at `2b599e822af0a1d8ac09464d8e6fc837c7ab5932`
- Corrective gate: `gate/P5-G1R1-owner-contract-resolution`
- Phase branch: `phase/P5-agent-control-plane`
- G1R1 was created from the blocked G1 head so the blocked evidence and its Owner resolution form one auditable lineage.
- Master integration is not authorized by this gate.

## G1 Historical Outcome

The original G1 correctly ended at `BLOCKED_OWNER_CONTRACT_GATE`. The Technical Package fixed the main P5/P3/P4 boundaries but did not define seven consequential contracts: agent identity/versioning, AgentRole semantics, permission composition, context authority/snapshot rules, instruction precedence, executable autonomy limits, and immutable Run revalidation. G1 performed no schema or runtime mutation and was not integrated into the phase branch.

## G1R1 Outcome

The Owner decision in P5-G1R1 resolves all seven contract groups and approves a minimum sufficient P5 V1 governance model:

- `AgentDefinition` is the stable semantic identity; immutable published `AgentDefinitionVersion` is execution identity.
- One immutable `AgentRoleVersion` binds each Run. AgentRole is distinct from P2 human RBAC, and P5 V1 has no role inheritance or composition.
- Authority is deny-by-default intersection. No Agent artifact can exceed the authenticated initiator ceiling or widen a higher-level deny.
- Every Run receives an immutable canonical-hashed `ContextPackage`, `PermissionManifest`, and concrete `RunBudget`.
- Exact-scope context is the default. Descendant aggregation is explicit, enumerated, fully authorized, and evidenced; sibling and cross-Organization inclusion is denied.
- Retrieved content and tool output remain data and cannot alter policy, permission, approval, Worker, or lease authority.
- Retry and approval resume reuse the original immutable artifacts. Restrictive policy or revoked authority denies future action; permissive policy never widens an existing Run.
- P3 remains the durable AgentRun/Approval owner, P4 remains the sole Worker/runtime/Codex boundary, and P6 tool/MCP implementation remains deferred.

The full approved contract is in `P5_CANONICAL_CONTRACT_FREEZE.md`. The durable decision and evolution path are recorded in `docs/adr/0004-p5-agent-control-contract.md`.

## Verification Actually Run

| Check | Result |
|---|---|
| Master, P5 phase, and original G1 tracking/live preflight | PASS — exact required SHAs |
| Empty G1R1 local/tracking/live checkpoint before contract mutation | PASS — `2b599e822af0a1d8ac09464d8e6fc837c7ab5932` |
| `CONTEXT.json` and `STATUS.json` parse and required state fields | PASS |
| Freeze status, R1 section, resolved questions, and contract-field assertions | PASS |
| ADR-0004 numbering, status, and required sections | PASS |
| Seven-lane adversarial contract review | PASS |
| Exact staged artifact inventory | PASS — six Work Order documents and ADR-0004 only |
| `git diff --cached --check` | PASS |
| Changed-artifact credential/private-key signature scan | PASS — zero matches |
| Schema, migration, runtime, route, test, dependency, P3/P4 mutation audit | PASS — none |
| P6+ implementation scope audit | PASS — semantics only; implementation deferred |
| Repository-artifact language audit | PASS — English only |

Final G1R1 remote SHA equality, strict fast-forward phase integration, and unchanged-master proofs are post-commit publication checks and are reported from live Git evidence rather than predicted here.

No runtime test, build, Prisma command, migration, or live Codex POC is required for this documentation-only gate.

## Scope

- Schema change: NONE
- Migration change: NONE
- Runtime/application change: NONE
- Route change: NONE
- Dependency change: NONE
- P3/P4 change: NONE
- P6+ implementation: NONE
- Deployment or production database action: NONE
- P5 runtime implementation started: NO

## Gate Result

- G1 original: BLOCKED_OWNER_CONTRACT_GATE
- G1R1: PASS, subject to the remote publication and strict fast-forward proofs required by this gate
- P5-G1 contract freeze: APPROVED
- P5-G2 entry gate: PASS only after G1R1 is remote-verified and integrated into the remote P5 phase branch

Do not start P5-G2 in this gate.

## P5-G2 — Definition and Role Registry Foundation

### Outcome

- Added stable `AgentDefinition` and `AgentRole` parents and parent-local ordinal version histories.
- Added strict V1 semantic payload validators. Definition payload contains only objective and instructions; Role payload contains only operating constraints. Neither payload grants permission, tenant authority, Worker authority, or P2 authority.
- Added exact `PLATFORM`, `ORGANIZATION`, `WORKSPACE`, and `BRAND` owner representations with compound P2 ancestry foreign keys and database shape checks.
- Owner identity is immutable after creation. PLATFORM is representable and applicable, but human PLATFORM mutation fails closed because the canonical P2 package has no platform bootstrap authority; no arbitrary actor fallback was invented.
- Added `ACTIVE`, `SUSPENDED`, and terminal `ARCHIVED` parent lifecycle and `DRAFT`, immutable `PUBLISHED`, and immutable `RETIRED` version lifecycle.
- Added a partial unique index for at most one published version per parent. Publication retires the current version and publishes the fresh draft in one serializable transaction.
- Added parent revision and draft base revision compare-and-swap. Two drafts from the same parent revision cannot both become successful publications; stale publication returns `PUBLISHED_VERSION_CONFLICT`.
- Added deterministic SHA-256 hashes over canonical semantic content using the existing stable JSON primitive.
- Added exact historical version resolution even after retirement or parent suspension/archive. New selection requires an active parent, a published version, and real ancestor applicability.
- Added governance audit events for every exposed registry mutation without storing full semantic payloads in audit metadata.

### Migration and Data Preservation

- Forward migration: `20260908090000_add_p5_agent_registries`.
- Fresh deploy: PASS.
- Second deploy: PASS.
- Populated canonical P4 deploy: PASS.
- Preserved before/after rows: 1 identity, 1 Organization, 1 Workspace, 1 Brand, 1 Membership, 1 AgentRun, 1 Job, 1 ApprovalRequest, 1 Worker, 1 Worker Workspace grant, 1 WorkerCredential, 1 WorkerLease, and 1 AuditEntry.
- New P5 identities created by migration: 0.
- Existing canonical data loss: 0.
- Existing authority widening: 0.
- Foreign-key violations: 0.
- Destructive schema operations: 0.
- Production migration performed: NO.

### Verification Actually Run

| Check | Result |
|---|---|
| Empty G2 local/tracking/live remote checkpoint | PASS at `90c40e916e19a3538c1c9c03321c4b032ae16a0a` before implementation |
| G2 registry and migration tests | PASS — 2 files, 16 tests |
| P2 tenancy/RBAC critical | PASS — 4 files, 46 tests |
| P3 critical | PASS — 9 files, 69 tests |
| P4 critical, excluding unchanged live Codex proof | PASS — 6 files, 23 tests |
| P1 module-boundary architecture | PASS — 1 file, 6 tests |
| Full repository, sequential SQLite-safe execution | PASS — 48 files passed, 1 skipped; 276 tests passed, 1 skipped |
| Production build | PASS — Next.js 15.5.25, 20/20 static pages generated |
| Prisma format / validate / generate | PASS |
| Fresh migration / populated P4 / second deploy / FK check | PASS |
| Standalone TypeScript delta | PASS — 0 new errors; the same 2 historical TS2352 diagnostics remain in `tests/ai/adapter-db-key.test.ts` |

The first parallel full-suite attempts exposed Windows SQLite/Prisma test-fixture contention as a 10-second P2 backup setup timeout. G2 originally deployed the complete migration chain once per registry test, amplifying subprocess contention. The G2 suite now uses one disposable database for the registry group, reducing its duration from about 60 seconds to about 16 seconds. The canonical full proof was then run with `--maxWorkers=1`, the established repository rule for SQLite-heavy migration/durability verification; no timeout was increased and no P2 code/test was changed.

### Scope

- Context Compiler: NOT IMPLEMENTED.
- Permission Compiler: NOT IMPLEMENTED.
- RunBudget enforcement: NOT IMPLEMENTED.
- P3 AgentRun binding: UNCHANGED.
- P4 Worker/Codex runtime: UNCHANGED.
- P6 tools/MCP: NOT IMPLEMENTED.
- Public registry route, UI, deployment, production database mutation, dependency change: NONE.

### Gate Result

- P5-G2: PASS, subject to final diff/security checks, remote G2 SHA equality, and strict fast-forward phase integration.
- P5-G3 entry gate: PASS only after those Git proofs complete.
- P5 remains `IN_PROGRESS`; it is not technically complete or canonical.
