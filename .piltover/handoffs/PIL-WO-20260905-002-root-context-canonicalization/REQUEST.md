# PIL-WO-20260905-002-root-context-canonicalization — Canonicalize Piltover root context bootstrap

Status: REVIEW_READY
Phase: P0.1 — Root Context Bootstrap Canonicalization

## Objective

Replace the accumulated PBOS-era root Markdown/bootstrap layer with a minimum sufficient,
non-conflicting Piltover context graph for Codex, Claude Code, and human developers.

## Authorized local mutations

- Rewrite root `AGENTS.md`, `CLAUDE.md`, and `README.md`.
- Harvest then remove obsolete root Markdown.
- Resolve direct references and retire bootstrap behavior that can recreate the legacy context.
- Write P0.1 handoff evidence and commit on the Work Order branch.

## Out of scope

No P1 module boundaries, product code behavior, schema/database migration, UI work, provider/worker/MCP
implementation, dependency modernization, deployment, merge, push, or release.

## Acceptance focus

All root Markdown is inventoried and harvested; the final root has one shared bootstrap, one thin
Claude adapter, and one human entry point; references and bootstrap cycles are resolved; evidence is
recorded; application behavior is unchanged; DONE means STOP.
