# STATE.md — loop state tracker

> Sprint-level view. Read this first each session, then drill into plan.md (the how)
> and todo.md (the checklist). Keep all three in sync (see RULES.md).

## Sprint goals
- Ship the Personal Brand OS MVP across `M0 -> M10` (see SPEC.md), one milestone per
  `/clear` session, VERIFY-gated.

## In-progress
- (empty — M5 done on master; M6 next: Strategy Builder 30d + Versioning + Export ⭐ mốc lớn,
  cân nhắc 2 phiên.)

## Blocked
- (none)

## Completed this session
- **M5 — Audience & Pillars + REVIEW GATE PASS.** D.2 `audience` (2–4 persona) + D.3 `pillars`
  (3–5 pillar) modules; objectiveMix enum keys built from `OBJECTIVES` (LLM never sets enum).
  **Ratio normalized in code 3× (module normalize hook + server savePillars + RatioBar)** via
  `lib/strategy-engine/normalizeRatio.ts` (largest-remainder, sum=100 exact). **Review gate =
  `AppState.audienceApprovedAt DateTime?`** (migration `audience_approval`): ApproveGate disabled
  until 2 checkboxes + saved + not-dirty; server `approveAudience` re-guards ≥2 persona & ≥3 pillar;
  Strategy page renders locked EmptyState when `approvedAt` null (no auto-chain; manual link only);
  edit-after-approve → resetApproval. Server actions diff-delete scoped by {userId,goalId}. Client
  fetches `/api/ai/{audience,pillars}` only. Verified: build 0 err · 19/19 vitest · seed idempotent
  2× (PromptTemplate=3). QA: scope-guard 0 BLOCKER (1 WARN fixed: pillar floor 1→3) · verifier M5
  DONE. Delegated: pbos-data-modeler + pbos-prompt-engineer + trellis-implement; gate via
  scope-guard + milestone-verifier. Live D.2/D.3 smoke deferred → ToFill.md §3.

## Completed earlier this session
- **M4 — AI Layer + Guard + Brand Analyzer (D.1) PASS.** Shared `lib/ai/*` pipeline (P0.3) +
  D.1 wired into onboarding. Raw-fetch adapter (no SDK) to Anthropic Messages API + OpenAI
  chat/completions; **temperature capability guard** (omit for opus-4-7/4-8/fable-5, else 400);
  model from AIModelConfig || env AI_DEFAULT_MODEL (no hardcode). `runModule` = validateInput →
  sanitizeExternal(<<DATA>> injection guard) → GLOBAL_CONTRACT+system → call → safeJsonParse →
  zod validate → repairOnce → savePromptRun (try/catch, never throws). D.1 brand-dna module
  (temp 0.2, threeWords tuple[3]); route `runtime=nodejs`; `AiSuggestionPanel` enabled (fetch
  route only, apply threeWords). Seed +PromptTemplate(brand-dna) idempotent. Added vitest +
  `tests/prompts/brand-dna.test.ts` (4 cases: ok/repair/invalid_json/sanitize). Verified: build
  0 err · npm test 4/4 · seed 2× identical (PromptTemplate=1). QA: scope-guard 0 violations ·
  milestone-verifier M4 all-PASS. Impl via pbos-prompt-engineer + pbos-data-modeler (seed).
  Live real-API smoke deferred (no key here) — set AI_DEFAULT_MODEL in .env to run D.1 live.
- **M11 Phase A — Electron desktop shell (dev window).** APPROVED scope exception (user wants
  a real local desktop app, not `npm run dev`). `electron/main.js` spawns Next dev on PORT
  3005, polls until ready, opens a 1400×900 BrowserWindow at localhost:3005; taskkill tree on
  quit. Scripts: `npm run app` (+ `main` field). No web behavior/entity change. Verified:
  `node --check` OK + Next boots on 3005 (onboarding 200). GUI launch is user-side (no display
  here). Phase B (installer + Prisma engine bundling) deferred to after M10. Logged in
  RULES.md + SPEC.md exception sections.
- **M3 — Onboarding Wizard PASS.** 2-step wizard (Brand DNA+company → Goal). Deps: zod,
  zustand, @tanstack/react-query, mammoth, pdf-parse@2. Persistence = server actions
  (`onboarding/actions.ts` save/get, upsert userId="local", setActive AppState singleton);
  `/api/upload` route (mammoth docx / pdf-parse pdf / image→415). pdfjs bundling fix via
  `serverExternalPackages`. Zustand wizard draft hydrated from server; page `force-dynamic`
  for reload persistence. Components: brand/{OnboardingWizard,BrandDnaForm,FileDropzone,
  AiSuggestionPanel(disabled)}, forms/{GoalForm,KpiEditor,ContentRatioSlider}, ui/{input,
  textarea,label}, Providers (QueryClient). Verified live: Playwright walk (hydrate seeded →
  finish → DB goal.name updated, activeGoalId set, count 1/1) + curl upload 400/415/200.
  QA: scope-guard 0 violations · verifier M3 DONE (build 0 err, seed idempotent 2x). No test
  files (M3 lists none; tests start M4).

## Completed prior session
- **M2 — Database + Seed PASS.** prisma@6.19.3 + @prisma/client@6 + tsx installed; `.env`
  created (`DATABASE_URL="file:./dev.db"`, gitignored). `migrate dev --name init` →
  `prisma/migrations/20260708120843_init` + `dev.db`. `lib/db.ts` = Prisma singleton
  (globalThis guard, exports `db`+`prisma`). `prisma/seed.ts` (tsx) idempotent via upsert on
  fixed id/key/slug; `--domain` arg (khang-guru default / dongy). Seeds: UserProfile id="local",
  BrandDNA(+company), 1 Goal id="goal-default", AppState{singleton, activeGoalId=goal-default},
  6 ContentObjective (keys from `OBJECTIVES`), 4 Framework (aida/pas/bab/storybrand), 5
  ContentTemplate, AIModelConfig{provider:anthropic, model:""}. Seed x2 → counts identical.
  `npm run build` 12/12 static, 0 type errors. QA: scope-guard 0 violations · verifier 6/6
  gates PASS. Impl delegated to pbos-data-modeler. NOTE: `package.json#prisma` deprecated in
  Prisma 7 (warning only) — defer.

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
- Run **M6 — Strategy Builder 30d + Versioning + Export** ⭐ (mốc lớn): layered generator
  (D.4 arc + weekly themes → D.6 weekly→daily ×5 → assemble 30 days in code), StrategyVersion v1
  (reason non-null + assumptions), export Markdown, set `AppState.activeStrategyId`. Gate is already
  wired (audienceApprovedAt). **KHUYẾN NGHỊ chia 2 phiên** (a: prompts+2 routes+engine; b: UI+export
  +test). Fresh `/clear` session.
- Git: repo init'd, `master` branch, identity = minhkhang.guru (local config). No remote yet.
