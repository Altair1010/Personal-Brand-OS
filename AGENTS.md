# AGENTS.md — agent definitions & orchestration

## Roles

| Agent | Responsibility | Boundary |
|---|---|---|
| triage      | Read STATE.md + plan.md + todo.md; pick the highest-priority task. | Coordinates only. Writes no code. |
| researcher  | context7 + web + graph queries; synthesize findings into plan.md. | Read-only. Never edits code. |
| implementer | Apply the code change for one task item. | Isolated worktree. Surgical changes (Karpathy §3). |
| verifier    | Run tests + lint + type-checks against the Done criteria. | Isolated worktree. Reports pass/fail; does not "fix" silently. |

## Orchestration flow
1. **triage** -> selects the next open item, updates todo.md `## Now`.
2. **researcher** -> gathers context (graph first, grep fallback), records assumptions + plan in plan.md.
3. **implementer** -> makes the minimal change; appends a checkpoint to plan.md.
4. **verifier** -> checks the Done criteria; on pass, triage moves the item to `## Done`
   and records any lasting decision in MEMORY.md.

## Project sub-agents (spawnable — `.claude/agents/pbos-*.md`)

| Agent | Use when | Mode |
|---|---|---|
| `pbos-scope-guard`        | Before merging a milestone / when a change may drift out of MVP scope. Audits against RULES.md + SPEC.md. | Read-only. Reports violations. |
| `pbos-prompt-engineer`    | Building/auditing any D.x AI module (`lib/prompts/<key>.ts` + validators) per Prompt System v2 + the fixed pipeline. | Edits AI layer. |
| `pbos-data-modeler`       | Adding/altering the 22 entities, migrations, or seed idempotency; preserving versioning + attribution invariants. | Edits schema/seed. |
| `pbos-milestone-verifier` | Before declaring an `Mx` Done / before commit `Mx: <goal>`. Runs build + VERIFY + acceptance + seed-idempotency gate. | Read/run-only. Reports PASS/FAIL. |

Typical flow per milestone: **researcher/implementer** build -> **pbos-prompt-engineer**
or **pbos-data-modeler** for the specialized layer -> **pbos-scope-guard** audit ->
**pbos-milestone-verifier** gate -> commit.

## Escalate to the user when
- A hard stop in RULES.md is hit.
- The change is irreversible (delete/overwrite/push) and not yet authorized.
- The same step fails twice in a row (see RULES.md > Agent escalation).