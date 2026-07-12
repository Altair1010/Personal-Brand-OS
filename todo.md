# todo.md — EM2 active checklist

Plan: `~/.claude/plans/c-3-repo-u-delightful-frog.md`

## EM2a — 3 repo integrations (phiên hiện tại)
- [x] T1 AI SDK generateObject (adapter+run, giữ interface+test, port temp guard) — build 0-err, vitest 91/91
- [x] T2 PostPreview + char counter
- [x] T3 KPI summary
- [x] checkpoint EM2a: build 0-err + vitest 92/92 + scope-guard (fix 2), commit `EM2a:`

## EM2b — smoketest fixes (DONE)
- [x] T4 fix hydration Badge-in-p (`<p>`→`<div>`)
- [x] T5 Tạo mới context menu (dropdown-menu.tsx + createBlankDraft)
- [x] T6 cloud bucket-not-found UX (bucket-missing msg + hint + ToFill)
- [x] T7 set-default model (setDefaultModelConfig + button + test)
- [x] T8 persona/pillar help+placeholder+sample panel (ReferenceSamplePanel)
- [x] checkpoint EM2b: build 0-err + vitest 94/94 + scope-guard 0, commit `EM2b:`

## EM2c — editing + Excel (DONE)
- [x] T9 manual edit Strategy+Calendar (migration editedAt) — updateDailyPlan/updateStrategyFrame, sửa tại chỗ
- [x] T10 Excel export Chiến lược (exceljs 6-tab) — /api/export/xlsx
- [x] T11 Excel report Settings (exceljs 6-tab readable) — /api/backup?format=xlsx
- [x] checkpoint EM2c: build 0-err + vitest 99/99 + scope-guard 0 BLOCKER + verifier DONE, commit `EM2c:`
