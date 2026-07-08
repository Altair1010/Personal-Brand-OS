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

**Approved exception — Desktop wrapper (Electron), milestone M11 (post-M10):** wrap the
existing Next.js localhost app in an Electron window (icon + own window, no browser). It
boots the same Next server + Prisma — no feature/entity change. Phase A = dev window (now);
Phase B = production installer + Prisma engine bundling (later). See RULES.md > "Approved
scope exceptions".

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
`M10` Settings + Backup + Polish. Order: `M0->M1->...->M10`; M6 & M7 split into 2 sessions.

## Acceptance criteria (verifier-checkable)
- Each milestone: `npm run build` passes with no type errors; the milestone VERIFY block
  passes; feature-spec acceptance for its module is met; `prisma db seed` is idempotent
  and does not destroy data.
- Empty -> full 30-day strategy in < 15 min via the single-pass onboarding wizard.
- Review gate blocks Strategy generation until Persona + Pillar are confirmed.
- Every AI response validates against its zod enum schema (repair-once on failure).
- Approving a draft creates a `Post` with non-null `strategyVersionId` + `dailyPlanId`.
- Backup -> restore JSON round-trip loses no data.
