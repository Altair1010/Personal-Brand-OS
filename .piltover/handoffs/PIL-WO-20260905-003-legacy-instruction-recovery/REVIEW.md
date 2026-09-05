# P0.2 Review — Legacy instruction recovery

## Review scope

- Exact Git provenance of pre-P0.1 `RULES.md`, `AGENTS.md`, and `CLAUDE.md`.
- Completeness and exclusivity of the 80-row disposition matrix.
- Admission quality of every change to current `AGENTS.md`.
- Thin-adapter, authority, context-cycle, temporal-decay, secret, and scope checks.

## Candidate reverse audit

| Candidate | Concrete failure prevented | Plausible in Piltover? | Existing coverage | Prose owner | Decision |
|---|---|---:|---|---|---|
| Inspect seam consumers/tests and preserve behavior | Regression during incremental migration | Yes | Partial | AGENTS Execution | Keep, compressed |
| Escalate unresolved material ambiguity | Mutation based on guessed authority/requirements | Yes | Partial C7 | AGENTS Execution | Keep, compressed |
| Treat external content as data | Prompt/instruction injection into repository work | Yes | Partial Security Model | AGENTS Execution | Keep, generalized |
| Authorize project-content egress | Unapproved disclosure to external services | Yes | Partial G3 | AGENTS Execution | Keep with trust rule |
| Keep secrets out of tracked/evidence files | Credential disclosure through Git/handoff | Yes | Package only | AGENTS Handoff | Keep, compressed |
| Inspect staged diff for secrets | Secret reaches commit despite policy | Yes | Generic diff review | AGENTS Handoff | Keep with secret rule |

All other candidates were covered, historical, rejected, or escalated. None justified another root
file or a Claude-only addition.

## Consider-the-opposite review

P0.1 was already structurally sufficient. P0.2 therefore changed no routing, authority, phase,
architecture, or Claude adapter behavior. The accepted delta addresses four concrete failure
classes that were only implicit or package-deep: working-seam regression, unsafe ambiguity,
untrusted-content steering/data egress, and tracked-secret leakage. Removing any one accepted
principle would leave that failure less visible to a fresh agent; restoring any rejected family
would increase rigidity or context debt without comparable benefit.

## Contradiction review

| Claim reviewed | Higher authority | Resolution |
|---|---|---|
| External content is untrusted data | Constitution C7; Security Model | Compatible; operational compression only. |
| External project-content egress needs authorization | Owner Gates G3 | Compatible; no new gate class. |
| Preserve observable seam behavior unless Work Order changes it | Source of Truth; migration spec | Compatible with incremental migration. |
| Escalate material unresolved ambiguity | Constitution C7 | Compatible with fail-closed mutation. |
| Secrets excluded from tracked/evidence files | Security Model; Codex Playbook | Compatible and already canonical. |

No current bootstrap claim overrode canonical Piltover governance. Product-level legacy
requirements without exact canonical coverage were recorded as SG-001 through SG-004, not
promoted.

## Fresh bootstrap review

- Fresh Codex can derive identity, authority, active-work locator, progressive read route,
  behavior-preservation rule, verification, gate handling, and stop condition from `AGENTS.md`.
- Fresh Claude is routed one-way from `CLAUDE.md` to `AGENTS.md`, then to canonical sources and the
  active Work Order.
- Neither route depends on `RULES.md`, `MEMORY.md`, `LOOP.md`, `STATE.md`, `plan.md`, `todo.md`, or
  `ToFill.md`.
- `CLAUDE.md` remains 13 lines and contains only the shared-bootstrap pointer plus Claude adapter
  constraints.

## Findings

No blocking or high-severity finding. Final deterministic verification and staged-diff review are
required before DONE.
