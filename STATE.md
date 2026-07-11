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
- (none) — EM1a DONE. Kế: EM1b (cần user tạo Supabase project + điền config, ToFill §5).

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

## Next
- **EM1b** — Tài khoản + backup cloud (Supabase free). Cần user tạo Supabase project + điền
  `SUPABASE_URL`/`SUPABASE_ANON_KEY` (ToFill §5) trước khi code. Có thể chia 2 phiên. Rồi EM1c.
- Còn treo (không chặn EM1b): live AI smoke D.1–D.15 (giờ nhập key qua Settings, ToFill §3) + user
  cài `.exe`/test GUI + tag CI Mac (ToFill §4).

## Env
- Git: repo init'd, `master` branch, identity = minhkhang.guru (local).
  Remote = `https://github.com/Altair1010/Personal-Brand-OS.git`. Tag `v0.1.0` kích CI desktop-build.
