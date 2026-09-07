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
