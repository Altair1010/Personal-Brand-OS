# STATE.md — loop state tracker

> Sprint-level view. Read this first each session, then drill into plan.md (the how)
> and todo.md (the checklist). Keep all three in sync (see RULES.md).

## Sprint goals
- Ship the Personal Brand OS MVP across `M0 -> M10` (see SPEC.md), one milestone per
  `/clear` session, VERIFY-gated.

## In-progress
- (empty — M1 verified done; M2 next). NOTE: repo not git-init → M1 commit pending.

## Blocked
- (none)

## Completed this session
- **M1 — Foundation + Constants + AppShell PASS.** Next.js 15 App Router + TS + Tailwind v3
  + shadcn (hand-authored button/card/badge) + AppShell (Sidebar 8 mục/Studio+Calendar 1
  group, Topbar, PageContainer, PageHeader) + shared states (EmptyState/ErrorState/AiLoading)
  + `lib/constants.ts` (sole enum source) + 9 route placeholders. `npm run build` = 12/12
  static, 0 type errors. Prisma NOT installed (deferred to M2 → pin prisma@6). QA: scope-guard
  0 violations · code-reviewer APPROVE (0 critical, minor fixes applied) · verifier 5/5 gates.

- **M0 — Docs & Scope Lock PASS.** Gates: schema 22 models (no Campaign/PainPoint/
  CompanyProfile) ✓ · docs consistent, forbidden names only in "BỎ" context ✓ ·
  `prisma@6 format` pass ✓. Promoted `Z-NeededUpdate/{docs,prisma/schema.prisma,.env.example}`
  -> repo root. Schema is **Prisma v6 syntax** (v7 rejects `datasource.url`) — pin prisma@6 in M1/M2.

- Fixed rtk PreToolUse hook path (backslash -> forward slash) in project settings.json.
- Restructured CLAUDE.md into PART A (project) / PART B (engine) + added the scaffold
  file maintenance protocol (§3a). Content preserved verbatim.
- Added 8 project hard rules to RULES.md; wrote the Trellis spec in SPEC.md.
- Pre-M0 cleanup of `Z-NeededUpdate/`: fixed stale entity count 19->22 across all docs +
  scaffold + agent defs (schema actually has 22 models); deleted brace-expansion garbage
  folder `{docs,prisma,data\seed}`. Docs content now internally consistent.

## Next
- Run **M2 — Database + Seed**: SQLite migrate, `lib/db.ts` singleton, seed "Khang Guru"
  idempotent, AppState singleton. **Pin prisma@6** (schema uses v6 syntax; v7 rejects
  `datasource.url` → P1012). `.env` needs `DATABASE_URL`. Fresh `/clear` session recommended.
- Optional: `git init` + commit `M1: Foundation + Constants + AppShell` before M2.
