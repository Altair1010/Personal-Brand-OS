# PIL-WO-20260905-003 — Recover legacy instruction value for Piltover

## Objective

Recover high-value operational knowledge from the latest pre-P0.1 versions of
`RULES.md`, `AGENTS.md`, and `CLAUDE.md`, then enrich the current Piltover bootstrap only
where durable, non-conflicting semantic value is missing.

## Scope

- Recover the three legacy sources through Git without restoring them at repository root.
- Atomize and classify their instruction content.
- Compare candidates with current bootstrap and the minimum canonical Piltover governance,
  migration, and handoff sources.
- Admit only high-leverage semantic delta into `AGENTS.md` or Claude-only delta into
  `CLAUDE.md`.
- Record provenance, decisions, context cost, and verification evidence.

## Acceptance

- Every recovered semantic atom has exactly one disposition.
- `RULES.md` and the retired root context system remain absent.
- No authority conflict, duplicate rule system, context cycle, stale state, or P1 work is
  introduced.
- Fresh Codex and Claude bootstrap routes remain sufficient.
- Verification is recorded; DONE means STOP.

## Non-goals

No application code, architecture scaffold, schema, UI, dependency, infrastructure, agent
system, or broad documentation cleanup.
