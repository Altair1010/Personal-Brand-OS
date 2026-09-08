# Review — PIL-WO-20260908-008-agent-control-plane

Decision: BLOCKED

## Seven-Lane Convergence

| Lane | Finding | Evidence | Decision |
|---|---|---|---|
| Identity | Requested human, AgentRole/definition version, Worker, and approver are distinct, but stable Agent/Definition identity is not defined. | Domain graph, Agent Control Plane, current P3/P4 models | OWNER DECISION REQUIRED |
| Versioning | Runs must preserve exact configuration refs and hashes; lifecycle and immutable storage rules are absent. | Constitution C6, Agent Control Plane persisted refs | OWNER DECISION REQUIRED |
| Tenancy | Runs and context are tenant-bound and cross-Brand mixing is forbidden; role/definition ownership and inheritance are absent. | Tenancy/RBAC, Context Compiler | OWNER DECISION REQUIRED |
| Context | Minimum, scoped, filtered, hashed context is required; snapshot, retention, secret, and aggregation rules are absent. | Constitution C12, Context Compiler | OWNER DECISION REQUIRED |
| Permission | Tool manifests are scoped and deny-by-default; complete schema, composition, precedence, initiator ceiling, and invalidation are absent. | MCP Permission Model, Security Model | OWNER DECISION REQUIRED |
| Approval | P3 owns payload-bound durable approval; resume/recompile/revalidation policy remains absent. | Owner Gates, existing `PrismaApproval` | OWNER DECISION REQUIRED |
| Execution | P3/P4 ownership and opaque reference handoff are clear; P5 may not call Codex or local runtime directly. | Bridge Spec, current execution envelope | PASS |

## Adversarial Review

| Concern | Finding | Canonical evidence | Attack / falsifier | Severity | Resolution |
|---|---|---|---|---|---|
| Identity confusion | `roleRef` could ambiguously identify a role, definition, or composed profile. | RunRequest and Agent Control Plane only require a reference. | Bind same ref text to different objects; old run becomes ambiguous. | Critical | Owner defines stable identifiers and binding. |
| Role escalation | Package does not define an initiator ceiling or AgentRole conflict algorithm. | P2 RBAC and Agent autonomy are separate documents. | `agent.run` launcher compiles `content.publish`. | Critical | Owner freezes intersection and ceiling. |
| Version mutability | Exact refs are required but immutable lifecycle/storage is not specified. | C6 and persisted configuration list. | Edit active definition; query old run. | Critical | Owner freezes version semantics. |
| Cross-tenant context | Isolation is explicit, but ancestor/child aggregation policy is not. | Tenancy/RBAC forbids Brand A/B mixing. | Workspace run auto-loads all child Brands. | Critical | Owner defines aggregation rule; default remains deny. |
| Context overfetch | Minimum-context goal lacks resource-class allowlists and budgets. | Context Compiler exclusion examples. | Request broad task and observe unrelated history. | High | Owner freezes inputs/bounds. |
| Permission union | Deny default exists; multi-source conflict order is absent. | MCP Permission Model and C7. | Role allow cancels Organization deny. | Critical | Owner freezes deny precedence and composition. |
| Stale permissions | No invalidation or revalidation contract. | Run state and manifest refs exist. | Revoke policy after compile, then call tool. | Critical | Owner selects revalidation semantics. |
| Prompt injection | Server enforcement exists, but prompt instruction ordering is absent. | Security Model requires structured allowlists. | Retrieved page claims higher authority. | Critical | Owner freezes instruction precedence; context remains data. |
| Approval bypass | P3 protects payload/target/expiry, but P5 action classification is not executable. | Owner Gates and `PrismaApproval`. | Rename consequential tool as reversible action. | Critical | Owner freezes classification/policy version. |
| Capability/permission confusion | Package explicitly separates routing capability and tool permission, but no compiler intersection is formalized. | Worker capability docs and MCP Permission Model. | Capable Worker executes manifest-denied browser/tool. | Critical | Preserve independent checks. |
| Initiator/Agent confusion | Human provenance is not stored on current AgentRun; approval stores requester separately. | Current Prisma models. | AgentRun cannot prove who authorized initial authority. | High | Owner decides run provenance/binding. |
| Unbounded autonomy | P5 lists budgets/concurrency/retry but specifies no values or policy objects. | P5 phase spec. | Infinite retry/tool loop or approval wait. | Critical | Owner defines executable limits and owner. |
| P4 bypass | Current boundary is strong and reference-based. | Bridge Spec and `PrismaExecutionEnvelope`. | Import adapter or pass raw path/RPC from P5. | Critical if introduced | Freeze prohibition; future dependency test. |
| P6+ scope creep | MCP documents clarify future enforcement but are not P5 implementation authority. | Roadmap P5 before P6. | Implement MCP broker/tool catalog in G1/G2. | High | Defer P6 implementation. |

## Reverse-Graph Review

```text
SAFE AGENT ACTION
       ^
P4 runtime enforcement                 [canonical]
       ^
exact permission manifest              [concept canonical; compiler gap]
       ^
authorized minimum context             [concept canonical; authority/snapshot gap]
       ^
immutable definition version           [required; identity/lifecycle gap]
       ^
resolved AgentRole                     [required; tenancy/composition gap]
       ^
tenant-safe run + authorized initiator [tenant half canonical; transfer/ceiling gap]
```

The first invalid edge is not P4. It is the missing P5 semantic contract between an authorized initiator and the exact immutable role/definition/context/permission bundle. Implementing downstream tables first would merely persist ambiguity.

## Architecture / Constitution Review

- Scope: PASS — documentation-only freeze; no P6+ implementation.
- Boundaries: PASS for P3/P4 ownership; BLOCKED for unresolved P5 semantic contracts.
- Data safety: PASS — no schema/data mutation.
- Observability: package requires run traces and exact refs; precise step/tool/artifact persistence remains an implementation-contract question.
- Security: BLOCKED until the consolidated Owner decisions are made.
- ADR: no ADR is appropriate before the missing decisions exist.

## Required Changes

1. Resolve the seven groups under `OWNER GATE — P5 CANONICAL CONTRACT`.
2. Update the freeze to `APPROVED_BY_CANONICAL_SOURCE` or an explicitly Owner-approved state.
3. Re-run proportional review and publish a new gate commit.
4. Only then strictly fast-forward the passing G1 into the P5 phase branch.

## Non-Blocking Notes

- Current P3/P4 opaque refs correctly reserved a forward-compatible seam; no P4 protocol change is justified in G1.
- Physical persistence candidates must be minimized after consumers and lifecycle rules are approved; no-consumer concepts remain deferred.

## P5-G1R1 Owner Contract Review

Decision: PASS

The original findings above remain historical evidence of why G1 stopped. The Owner decision in P5-G1R1 resolves every Critical contract gap without runtime or schema mutation.

### Seven-Lane Convergence R1

| Lane | Approved control | Adversarial result |
|---|---|---|
| Identity | Stable `AgentDefinition`; exact immutable published `AgentDefinitionVersion` bound to every Run | PASS — later draft/current-version changes cannot reinterpret a historical Run |
| Role | One immutable `AgentRoleVersion`; separate from P2; no inheritance/composition/multi-role | PASS — role applicability and desired behavior cannot manufacture human or tenant authority |
| Context | Exact-scope immutable snapshot; enumerated fully authorized descendant aggregation only | PASS — implicit sibling, wildcard, and cross-Organization inclusion are denied |
| Permission | Deny-by-default intersection; explicit deny and missing authority deny; P2 initiator ceiling | PASS — no lower-level allow, definition, role, or autonomy setting can widen authority |
| Instruction | Fixed precedence; retrieved context and tool output are structurally data only | PASS — prompt injection cannot modify non-prompt policy, manifest, approval, Worker, or lease truth |
| Autonomy | Concrete default and hard-ceiling `RunBudget`; every layer may only lower; nested Runs false | PASS — steps, tools, time, context, concurrency, retries, and approval wait are bounded |
| Revalidation | Same immutable artifacts on retry/resume; restrictive changes deny; permissive changes do not widen | PASS — authority is monotonic for the life of one AgentRun |

### R1 Adversarial Findings

| Concern | Attack / falsifier | Approved resolution | Severity after resolution |
|---|---|---|---|
| Identity confusion | Resolve `latest` after publication and compare an old Run | Run pins exact immutable definition and role versions plus hashes | Closed |
| Role escalation | AgentRole requests a mutation the initiator lacks | P2 initiator authority is a hard ceiling and all conditions intersect | Closed |
| Cross-tenant context | Workspace Run requests sibling Workspace or implicit child Brand data | Exact scope defaults; explicit descendant IDs and per-scope read proof are mandatory | Closed |
| Context overfetch | Broad request imports unrelated history or all accessible Brands | Data class, scope, definition, role, task, policy, and token budget all constrain inclusion | Closed |
| Permission union | Role allow conflicts with tenant/initiator deny | No union; explicit deny or missing requirement wins | Closed |
| Stale manifest | Policy/initiator authority is revoked before start, retry, resume, or write | Mandatory current revalidation denies future action while preserving original evidence | Closed |
| Permissive policy drift | Policy becomes broader after compilation | Existing manifest remains the ceiling; wider authority requires a new Run | Closed |
| Prompt injection | Retrieved text claims system or administrator authority | Context/tool output are data in the compiled representation, not instruction tiers | Closed |
| Approval bypass | Gated payload changes after approval | P3 approval remains exact action/target/payload bound, valid, and unconsumed | Closed |
| Capability confusion | Manifest allows a tool but Worker lacks capability/grant/lease | P4 capability, exact grant, and lease remain independent required downstream checks | Closed |
| Unbounded autonomy | Agent retries, nests, or waits indefinitely | Concrete budget ceilings, bounded retry/wait, concurrency limit, and no nested Runs | Closed |
| P4 bypass | P5 supplies path, executable, shell, secret, credential, or raw RPC | Contract prohibits these fields and keeps P4 as sole runtime/Codex boundary | Closed |
| P6 scope creep | Permission design grows a tool broker or MCP registry | Only opaque `toolRef` semantics are frozen; P6 implementation is deferred | Closed |

### Reverse-Graph R1

```text
SAFE AGENT ACTION
       ^
P4 capability + exact grant + lease + runtime enforcement
       ^
P3 run state + payload-bound approval when gated
       ^
immutable PermissionManifest under current restrictive revalidation
       ^
immutable exact-scope ContextPackage
       ^
immutable AgentDefinitionVersion + one AgentRoleVersion
       ^
tenant-safe task inside authenticated initiator ceiling
```

Every edge now has a canonical owner. Applicability is never authorization, capability is never permission, and approval never widens the manifest.

### R1 Scope Review

- Contract and ADR evidence only: PASS.
- Prisma/schema/migration/runtime/routes/dependencies/P3/P4 mutation: NONE.
- P6+ implementation: NONE.
- P5-G2 implementation: NOT STARTED.
- ADR threshold: PASS — ADR-0004 records the new permission/trust/lifecycle decision and its evolution path.

The passing G1R1 lineage may be strictly fast-forwarded into `phase/P5-agent-control-plane` after proportional checks and live remote SHA verification. This review does not authorize master integration or P5-G2 execution.

## P5-G2 Registry Foundation Review

Decision: PASS, subject to final publication and integration proofs.

| Lane | First safety question | Evidence and result |
|---|---|---|
| Identity | Can a stable parent be reused or silently moved? | PASS — unique IDs, owner identity DB trigger, no delete service, no extra Agent/Persona/Profile entity |
| Tenancy | Can invalid or cross-tenant ancestry persist? | PASS — exact owner-shape CHECK constraints plus Organization/Workspace/Brand compound foreign keys; service resolves ancestry before authorization |
| Versioning | Can two published versions or stale last-write-wins occur? | PASS — partial unique index, serializable replacement transaction, and parent-revision CAS |
| Immutability | Can historical semantic content or hashes change? | PASS — strict payload parsing, publication-time canonical hash, DB update/delete triggers for published/retired versions |
| Authorization | Can applicability or AgentRole substitute for human authority? | PASS — Organization mutation requires P2 `organization.manage`; Workspace/Brand mutation requires exact P2 `agent.manage`; PLATFORM mutation fails closed |
| Migration | Can P5 alter P2/P3/P4 rows? | PASS — forward-only additive tables/indexes/triggers, exact populated-row preservation, zero legacy conversion, clean FK check |
| Future compatibility | Did G2 implement context, permission, Run binding, P4, or P6 semantics? | PASS — narrow V1 definition/role payloads and registry selection only; later compilers and runtime boundaries remain absent |

### Root-Cause Corrections

1. Initial DB review showed that valid owner columns could be changed together after parent creation. The first invalid edge was mutable owner identity, not applicability logic. A failing direct-DB falsifier was added, then owner-identity triggers made parent ID and owner ancestry immutable.
2. Four-worker full regression exposed P2 backup fixture timeout under concurrent full migration deploys. The cause was migration-process amplification from per-test G2 database creation. G2 consolidated registry tests onto one disposable suite database, preserved isolation through generated identities and delta assertions, and reduced targeted runtime by roughly 74%. Final full proof ran sequentially under the established Windows SQLite rule.
3. Concurrent Prisma generate failed once with `EPERM` while build/tests held the Windows query-engine DLL. No code was patched. Sequential Prisma format/validate/generate passed after the owning processes exited.

### Five-Axis Quality Review

- Correctness: PASS — lifecycle, publication, stale conflict, applicability, historical resolution, and error paths have behavioral falsifiers.
- Readability: PASS — one domain contract and one internal Prisma registry keep G2 concepts local; no public surface or speculative provider abstraction was added.
- Architecture: PASS — domain code is provider-free, Prisma remains in infrastructure, existing P2 access and stable-hash primitives are reused, and P1 boundary tests pass.
- Security: PASS — fail-closed validation/authorization, exact ancestry, immutable history, safe audit evidence, no raw payload audit, and no new dependency or secret surface.
- Performance/operability: PASS — bounded point lookups and transactional writes only; test migration contention was removed at its G2 fixture source.

### Known Non-Blocking Limitation

The canonical P2 package has no authenticated platform-bootstrap authority. G2 therefore represents PLATFORM ownership and supports its applicability/historical semantics but rejects human PLATFORM registry mutation with `UNAUTHORIZED`. A future Owner-approved platform provisioning path is required before PLATFORM artifacts can be created through an application service. G2 does not weaken this edge with a caller-supplied actor ID.
