# STATE.md — loop state tracker

> Sprint-level POINTER, not a logbook. Read first each session, then drill into
> plan.md (the how) + todo.md (the checklist). Keep all three in sync (RULES.md).
> **No technical detail here** — milestone id + one-line status only. Full
> decisions/patterns live in MEMORY.md (one entry per milestone). See RULES.md >
> "STATE vs MEMORY".

## Sprint goals
- Ship the Personal Brand OS MVP across `M0 -> M10` (see SPEC.md), one milestone per
  `/clear` session, VERIFY-gated.

## In-progress
- (none) — next milestone: **M9 — Weekly Review / Revision Engine**.

## Blocked
- (none)

## Completed
- **M0–M8 DONE** (M8 = Performance Lab). Per-milestone detail + patterns → MEMORY.md.
- Live D.1–D.14 AI smoke (needs API key) still deferred → ToFill.md §3.

## Next
- **M9 — Weekly Review / Revision Engine (nhẹ)**: rule-based warnings + 1 call AI (D.15
  `revision`) → StrategyVersion mới có `reasonForNewVersion` (non-null); dùng Post→StrategyVersion
  attribution để so sánh; review UI + RevisionDiff + Dashboard WeeklyAdjustmentCard. Tiền đề đủ
  (M8 có PerformanceInsight). Fresh `/clear` session.

## Env
- Git: repo init'd, `master` branch, identity = minhkhang.guru (local). No remote yet.
