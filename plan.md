# plan.md — live execution plan

> LIVE FILE. Continuously updated while a task is in flight. Read it (with todo.md
> and STATE.md) before acting. DELETE it once the Done criteria are verified — then
> promote any lasting decision into MEMORY.md. See RULES.md > "plan.md & todo.md lifecycle".

## Context
- EM2b = smoketest fixes T4–T8 (plan `~/.claude/plans/c-3-repo-u-delightful-frog.md` §EM2b).

## Goal
- build 0-err + vitest pass + scope-guard clean; commit `EM2b:`.

## Steps
1. T4 hydration Badge-in-p: AiModelConfigForm `<p>`→`<div>` -> verify: build
2. T5 Topbar "Tạo mới" dropdown + createBlankDraft action + dropdown-menu.tsx -> verify: build
3. T6 cloud bucket-missing msg (cloud-backup.ts push/pull + BackupPanel hint + ToFill) -> verify: build
4. T7 setDefaultModelConfig action + "Đặt mặc định" button + test -> verify: vitest
5. T8 help-text persona/pillar + PersonaEditor/PillarBoard placeholders + ReferenceSamplePanel -> verify: build
6. checkpoint: build+vitest+scope-guard, commit

## Checkpoints (append-only log)
- (append as we go)

## Done criteria
- npm run build 0-err; vitest all pass + setDefault test; scope-guard 0 BLOCKER.
