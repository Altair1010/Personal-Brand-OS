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
- (none) — **web MVP M0–M10 + M11 (desktop runtime) hoàn tất**. Còn **M12 (packaging)**.

## Blocked
- (none)

## Completed
- **M0–M10 DONE** (M10 = Settings + Backup + Polish — web MVP mốc cuối). Detail + patterns → MEMORY.md.
- **M11 DONE** (Desktop runtime — Electron production boot standalone + DB→userData + first-run migrate/seed
  + key từ `userData/pbos.env`). Verify FULL kể cả GUI: `npm run app:prod` mở Electron, first-run migrate+seed,
  server 200, DB ở `AppData\Roaming\Electron\pbos.db`. vitest 67/67, scope-guard PASS.
- Live D.1–D.15 AI smoke (needs API key) still deferred → ToFill.md §3.
- Desktop scope M11 cũ (Electron gộp) đã **tách đôi** → M11 runtime + M12 packaging (milestones.md PHẦN 3B).

## Next
- **M12 — Packaging (unsigned)**: electron-builder — `.exe` installer (Win, local, NSIS shortcut+icon) +
  `.dmg` (Mac qua GitHub Actions `macos-latest`). asarUnpack Prisma engines + externals; **extraResources
  bundle tsx+seed+prisma CLI** (M11 note: `runtime.js` paths chỉ đúng unpackaged). Cần user tạo GitHub
  remote trước (ToFill §4). Fresh `/clear`.

## Env
- Git: repo init'd, `master` branch, identity = minhkhang.guru (local). No remote yet.
