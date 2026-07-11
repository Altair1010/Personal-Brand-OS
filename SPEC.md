# SPEC.md — project spec (Trellis-compatible)

> Project: **Personal Brand Strategy OS** (MVP LOCKED). Single-user, localhost.
> Source of truth: `docs/product-master-plan.md` + `docs/milestones.md`. This SPEC is
> the condensed Goal / Scope / Acceptance contract the verifier checks against.

## Goal
A personal **content-strategy operating system**: `goal -> positioning -> strategy ->
content -> measurement -> revision`, with memory (it records *why* a direction was
taken) and a closed feedback loop. AI is a reviewed collaborator, not a one-off post
writer. First 30-day strategy produced from empty state in **< 15 min**; one FB post
written to an objective in **< 3 min**; after a week of metrics the Weekly Review yields
insight + adjustment with no manual editing.

## Scope
**In scope (MVP — 8 tab, 22 entity, 30-day, manual-first):**
- Dashboard.
- Onboarding wizard: Brand DNA (+company gộp) + upload docx/pdf -> Goal.
- Audience & Pillars: AI generate + edit + **review gate** + ratio normalized to 100.
- Strategy Builder **30 ngày** (per-week -> merged), versioning, Markdown export.
- Content Studio (plain-text Hook/Body/Ending) + AI writer/hook/cta/tone + status
  workflow + **attribution** + Calendar.
- Performance Lab **manual** (reach/engagement/comments/saves + note) + charts +
  AI insight with evidence/confidence.
- Weekly Review / Revision Engine (rule-based + 1 AI call, version with reason).
- Settings: AI model config, backup/restore/reset (JSON round-trip).

**Out of scope (Phase 2 — do not build):** Inspiration Lab, Experiments, Strategy
60/90-day, CSV import, Meta/FB API, auto-publish, Prompt/Framework editor, separate
Company tab, time-series metrics, sentiment, image generation, multi-user/auth/cloud,
multi-platform, TipTap/rich text.

**Approved exception — Desktop app (Electron), split into M11 + M12 (post-M10):** wrap the
existing Next.js localhost app in an Electron window (icon + own window, no browser). Boots the
same Next server + Prisma — no feature/entity change.
- **M11 — runtime cross-platform:** boot the production build in Electron on Win + Mac; relocate
  SQLite to the OS user-data dir; first-run `migrate deploy`; API key from runtime (not repo `.env`).
- **M12 — packaging (unsigned):** `.exe` installer (Win, NSIS, desktop shortcut + icon) built
  locally; `.dmg` (Mac) built via GitHub Actions `macos-latest` runner (no cross-build from Win).
See RULES.md > "Approved scope exceptions".

**Approved extension — Extended Milestone 1 (EM1), post-M12 (user-approved 2026-07-11):**
deliberate expansion beyond the MVP lock. Overrides the "out of scope" items it names
(Meta/FB API, multi-user/auth/cloud) — IN scope for EM1 only, logged (not drift). Split
`EM1a → EM1b → EM1c` (order-locked). See `docs/milestones.md` PHẦN 4 + RULES.md.
- **EM1a — Key-in-UI + Help icons:** enter/name API key + pick model (Claude/GPT preset,
  level tag) in Settings; "!" help affordance on every user-fill input; content-gen
  transparency. Replaces manual `pbos.env`.
- **EM1b — Account + cloud backup:** Supabase Auth + Storage (free); encrypted snapshot
  restore on another machine; **secrets excluded from backup**. Local SQLite stays primary.
- **EM1c — Multi-Facebook + auto-fetch:** `FacebookAccount` per account, page switcher,
  Performance Lab pulls metrics via pasted Page token (Graph API; paste post URL → fill).

## Constraints (hard — full list in RULES.md)
- Stack: Next.js App Router + TS + Tailwind + shadcn/ui + Prisma + SQLite + Recharts +
  Zustand + TanStack Query. Node ≥ 20, Next ≥ 15. Plain structured editor, no rich text.
- AI server-side only; key in `.env` (gitignored); external data via `lib/ai/sanitize.ts`.
- Enums from `lib/constants.ts` + zod; no hardcoded model name; ratio normalized in code.

## Milestones (execution units — see `docs/milestones.md`)
`M0` Docs & Scope Lock · `M1` Foundation + Constants + AppShell · `M2` Database + Seed ·
`M3` Onboarding wizard · `M4` AI Layer + Guard + Brand Analyzer · `M5` Audience & Pillars
+ REVIEW GATE · `M6` ⭐ Strategy Builder 30d + Versioning + Export · `M7` ⭐ Content Studio
+ Calendar · `M8` Performance Lab (manual) · `M9` Weekly Review / Revision Engine ·
`M10` Settings + Backup + Polish · `M11`/`M12` Desktop runtime + packaging ·
`EM1a`/`EM1b`/`EM1c` Extended (key-in-UI · account+cloud backup · multi-Facebook).
Order: `M0->...->M10->M11->M12->EM1a->EM1b->EM1c`; M6 & M7 (and optionally EM1b) split into 2 sessions.

## Acceptance criteria (verifier-checkable)
- Each milestone: `npm run build` passes with no type errors; the milestone VERIFY block
  passes; feature-spec acceptance for its module is met; `prisma db seed` is idempotent
  and does not destroy data.
- Empty -> full 30-day strategy in < 15 min via the single-pass onboarding wizard.
- Review gate blocks Strategy generation until Persona + Pillar are confirmed.
- Every AI response validates against its zod enum schema (repair-once on failure).
- Approving a draft creates a `Post` with non-null `strategyVersionId` + `dailyPlanId`.
- Backup -> restore JSON round-trip loses no data.
