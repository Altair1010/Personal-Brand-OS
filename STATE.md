# STATE.md — loop state tracker

> Sprint-level POINTER, not a logbook. Read first each session, then drill into
> plan.md (the how) + todo.md (the checklist). Keep all three in sync (RULES.md).
> **No technical detail here** — milestone id + one-line status only. Full
> decisions/patterns live in MEMORY.md (one entry per milestone). See RULES.md >
> "STATE vs MEMORY".

## Sprint goals
- MVP `M0 -> M12` DONE. Sprint kế: **Extended Milestone 1 (EM1a → EM1b → EM1c)** —
  key-in-UI, tài khoản + backup cloud, đa Facebook. Plan: milestones.md PHẦN 4. One
  milestone per `/clear`, VERIFY-gated.

## In-progress
- **EM2 HOÀN TẤT** (plan `~/.claude/plans/c-3-repo-u-delightful-frog.md`). EM2a+EM2b+EM2c đều
  DONE (detail → MEMORY). EM2c = manual-edit Strategy/Calendar sửa-tại-chỗ (migration `editedAt`)
  + Excel export exceljs (strategy 6-tab + report 6-tab). Gate PASS: build 0-err, vitest 99/99,
  scope-guard 0 BLOCKER, verifier DONE. Còn treo: live smoke (AI + Supabase + FB token) — user-fill.
- EM1 (EM1a→EM1b→EM1c) hoàn tất. Còn treo: live smoke (AI + Supabase cloud sync + FB token) —
  user-fill (ToFill §3/§5).

## Blocked
- (none)

## Completed
- **M0–M10 DONE** (M10 = Settings + Backup + Polish — web MVP mốc cuối). Detail + patterns → MEMORY.md.
- **M11 DONE** (Desktop runtime — Electron production boot standalone + DB→userData + first-run migrate/seed
  + key từ `userData/pbos.env`). Verify FULL kể cả GUI: `npm run app:prod` mở Electron, first-run migrate+seed,
  server 200, DB ở `AppData\Roaming\Electron\pbos.db`. vitest 67/67, scope-guard PASS.
- Live D.1–D.15 AI smoke (needs API key) still deferred → ToFill.md §3.
- Desktop scope M11 cũ (Electron gộp) đã **tách đôi** → M11 runtime + M12 packaging (milestones.md PHẦN 3B).
- **M12 DONE** (Packaging unsigned — electron-builder nsis `.exe` 187.7M build local + CI `.dmg` Mac).
  Detail + winCodeSign local workaround → MEMORY.md. GUI install/launch + tải `.dmg` = user (ToFill §4).
- **EM1a DONE** (Key-in-UI + Help icons + minh bạch content-gen). Gate PASS: build 0-err, vitest 70/70
  (+`tests/ai/adapter-db-key.test.ts`), seed idempotent, scope-guard PASS. Keystore = Node crypto
  AES-256-GCM (không plaintext). Detail → MEMORY.md. Việc user: nhập key trong Settings (ToFill §5).
- **EM1b DONE** (Tài khoản Supabase + backup cloud mã hoá passphrase, loại secret). Gate PASS: build
  0-err, vitest 77/77 (+cloud-backup), seed idempotent (migration `appstate_supabase_binding`),
  scope-guard 0 violation, verifier DONE. Hard gate client-side; snapshot scrypt+AES-GCM; server dùng
  anon key + user Bearer (no service key). Detail → MEMORY.md. Việc user: Supabase project + bucket
  `backups` + RLS + config + live smoke (ToFill §5).
- **EM1c DONE** (Đa trang Facebook + Performance Lab tự fetch). Gate PASS: build 0-err, vitest
  89/89 (+`tests/facebook/graph.test.ts` +strip FacebookAccount), seed idempotent, migration
  `20260711082356_em1c_facebook` additive, scope-guard 0 violation, verifier DONE. Page token dán
  tay (không OAuth), mã hoá keystore + strip khỏi backup; auto-fetch 1 snapshot/Post; switcher
  scope qua `?fb=`. Detail → MEMORY.md. Việc user: FB Developer App + Page token (ToFill §5).

## Next
- (none — EM1 xong). Còn treo, đều user-fill: live AI smoke D.1–D.15 (ToFill §3), Supabase cloud
  sync (ToFill §5), FB Page token + dán link post thật (ToFill §5), cài `.exe`/test GUI (ToFill §4).

## Env
- Git: repo init'd, `master` branch, identity = minhkhang.guru (local).
  Remote = `https://github.com/Altair1010/Personal-Brand-OS.git`. Tag `v0.1.0` kích CI desktop-build.
