# MEMORY.md — persistent decisions & patterns

> Long-lived knowledge. When a plan.md/todo.md goal is done, distill any lasting
> decision here before deleting those files. One entry = one fact; keep it terse.

## Architecture decisions log
<!-- [YYYY-MM-DD] Decision — why — alternatives rejected -->
- [2026-07-08] **M0 PASS.** Promoted staging `Z-NeededUpdate/{docs,prisma,.env.example}`
  -> repo root. Schema = 22 models, no Campaign/PainPoint/CompanyProfile. Schema uses
  **Prisma v6 syntax** (`datasource.url`); v7 rejects it (P1012). Pin prisma@6 in M1/M2.
- [2026-07-08] Hook commands in `.claude/settings.json` use forward-slash paths
  (`C:/Users/.../rtk.exe`) — bash strips backslashes in Windows paths, turning
  `C:\Users\...` into `C:Users...` = command not found. Applies to all hook commands.
  Generator: `setup-claude-agent-system.ps1` > `Get-RtkCmd` now returns the path with
  `-replace '\\','/'`, so regenerating settings.json won't reintroduce the backslash bug.
- [2026-07-08] CLAUDE.md split into PART A (project) / PART B (engine) + §3a scaffold
  maintenance protocol mapping each root file (LOOP/MEMORY/plan/todo/RULES/SPEC/STATE)
  to when it must be updated. In plan mode, plans go to plan.md by path — never pasted
  into CLAUDE.md/chat.

- [2026-07-08] **M1 PASS** (committed `2194aea`, master; repo git-init'd, local identity
  minhkhang.guru, no remote). Scaffold =
  Next.js 15 App Router + TS, **Tailwind v3** (config file, not v4 CSS), shadcn primitives
  authored by hand (button/card/badge) to avoid network dep at build. **Prisma NOT installed
  in M1** (deferred to M2 — pin prisma@6 then). `lib/constants.ts` = sole enum source (5
  arrays `as const` + inferred types + `OBJECTIVE_COLORS`). AppShell = Sidebar(8 sections,
  Studio+Calendar one group)+Topbar+PageContainer in `app/layout.tsx`. Build 12/12 static, 0
  type errors. QA gate run via pbos-scope-guard (0 violations) + agent-skills:code-reviewer
  (APPROVE, 0 critical) + pbos-milestone-verifier (5/5 M1 gates PASS).

- [2026-07-08] **M2 PASS** (committed master). prisma@6.19.3 + tsx. Seed pattern =
  **upsert on fixed id/key/slug** for idempotency (UserProfile "local", Goal "goal-default",
  AppState "singleton", ContentObjective keyed by `OBJECTIVES`, Framework by slug). `--domain`
  arg reads `data/seed/<domain>.json` (khang-guru default, dongy alt) — domains share the same
  fixed ids so switching overwrites, never duplicates. `AIModelConfig.model=""` (never hardcode).
  `lib/db.ts` = globalThis-guarded Prisma singleton. **Run prisma via `node
  node_modules/prisma/build/index.js <args>`** and seed via `node node_modules/tsx/dist/cli.mjs
  prisma/seed.ts` — rtk hook + PATH break `npx prisma`/`tsx` ("Binary not found on PATH").

- [2026-07-08] **M3 PASS** (Onboarding Wizard). Stack adds: zod, zustand,
  @tanstack/react-query, mammoth, **pdf-parse@2** (rewrite over pdfjs-dist — API
  `new PDFParse({data:Uint8Array}).getText()→TextResult.text`; ships own types so NO
  `@types/pdf-parse`; getText appends a `-- N of M --` page footer). **pdfjs-dist breaks
  under webpack RSC bundling** ("Object.defineProperty called on non-object") → fixed via
  `next.config.ts` `serverExternalPackages:["pdf-parse","pdfjs-dist","mammoth"]`. Pattern:
  persistence = **Next server actions** (`saveBrandDna`/`saveGoal`/`getOnboardingData` in
  `app/(dashboard)/onboarding/actions.ts`), only `/api/upload` is a route (multipart).
  Wizard = Zustand transient draft (`lib/stores/onboarding.ts`) hydrated from server data;
  reload persistence is server-side (page `force-dynamic` + getOnboardingData), not
  localStorage. `saveGoal` routes update-vs-create off `AppState.activeGoalId` (not a Prisma
  upsert on goal unique) — correct for single-active-goal, but would create dup goals if
  activeGoalId is ever cleared (revisit M6). Company gộp into BrandDnaForm (no Company tab).
  AiSuggestionPanel = disabled placeholder (AI arrives M4). Added ui primitives
  input/textarea/label. **No test files** — M3 lists none + no runner yet (tests start M4);
  verified live (Playwright walk + DB check + curl 400/415/200). QA: scope-guard 0 violations
  · milestone-verifier M3 DONE (build 0 err, seed idempotent 2x).

- [2026-07-09] **M4 PASS** (AI Layer + Guard + Brand Analyzer D.1). Stack adds: **vitest** (devDep,
  `npm test`="vitest run", `vitest.config.ts` node env + `@` alias). **AI transport = raw fetch**
  (no SDK) — `lib/ai/anthropic.ts` POSTs `https://api.anthropic.com/v1/messages` (headers `x-api-key`
  + `anthropic-version: 2023-06-01`), parses `content[0].text` + `usage.input_tokens/output_tokens`;
  `lib/ai/openai.ts` = chat/completions parallel. **temperature capability guard:** Anthropic
  opus-4-7/opus-4-8/fable-5 return 400 if `temperature` sent → adapter OMITS it via
  `NO_TEMPERATURE=/(?:opus-4-(?:7|8)|fable-5)/`; kept for haiku-4-5/sonnet-4-6/opus-4-6 & older.
  **Model resolution (no hardcode):** `resolveModelConfig()` = AIModelConfig(isDefault).model ||
  `env AI_DEFAULT_MODEL`; empty → throws VN "Chưa chọn model AI…". Provider = row || AI_DEFAULT_PROVIDER
  || "anthropic". Pipeline P0.3 in `lib/ai/run.ts` `runModule(module,input,{adapter?})`:
  validateInput(inputSchema) → sanitizeExternal(<<DATA>>) → GLOBAL_CONTRACT+module.system →
  adapter.call → `safeJsonParse` (strip fences, slice `{`→`}`) → outputSchema.safeParse →
  **repairOnce** (P0.2 buildRepairPrompt) → normalize → savePromptRun. `adapter` is injectable for
  mock tests; **savePromptRun wrapped in try/catch** so DB failure never breaks pipeline & tests run
  hermetic (no live DB). runModule NEVER throws — resolves {ok, status: ok|invalid_json|error}.
  D.1 `lib/prompts/brand-dna.ts` = module `{key,system,buildUser,inputSchema,outputSchema,
  temperature:0.2,normalize}`; threeWords = `z.tuple([str,str,str])` (exactly 3). Route
  `app/api/ai/brand-dna/route.ts` `runtime="nodejs"`, POST→runModule→200/400. `AiSuggestionPanel`
  enabled: client fetches route only (never imports lib/ai/*), AiLoading, "Áp dụng" writes only
  `patchBrand({threeWords})`. Seed adds ONLY `PromptTemplate(brand-dna,v1)` upsert on compound
  unique `moduleKey_version` (canonical prompt stays in code per P13; DB row is a pointer). QA:
  scope-guard 0 violations · milestone-verifier M4 all-PASS (build 0 err, 4 tests, seed idempotent
  PromptTemplate=1). Live real-API smoke deferred (no key) — user sets AI_DEFAULT_MODEL to verify.

## Convention tracker
<!-- naming, structure, style rules discovered in this repo -->
- Project docs are staged in `Z-NeededUpdate/docs/` until M0 promotes them to `docs/`.
  CLAUDE.md paths (`docs/milestones.md`, etc.) assume the promoted location.
- **Schema has 22 entities, not 19.** `schema.prisma` + `database-schema.md:17` list all 22;
  the old "19" count (pre-AppState/PromptTemplate/PromptRun) was stale and fixed across all
  docs + scaffold + agent defs on 2026-07-08. M0 gate now checks "22 entity". Use 22.
- 8 project hard rules live in RULES.md > "Project hard rules"; SPEC.md holds the
  condensed Trellis Goal/Scope/Acceptance contract.
- **3-step bootstrap pipeline** (`templates/idea-to-docs-master-prompt.md`): Prompt 1
  (Idea -> 6 docs incl. `CLAUDE.project.md`) -> `setup-claude-agent-system.ps1` (generic
  engine scaffold; CLAUDE.md now has `# PHẦN A` placeholder + `# PHẦN B` engine + §3a) ->
  Prompt 2 (customize SPEC/RULES/STATE/LOOP + spawn `<proj>-*` agents). Docs = single
  source of truth; scaffold only points to them; Prompt 2 owns the merge (no hand-merge).

## Bug workaround registry
<!-- symptom -> root cause -> workaround -> permanent fix ref -->
- (none yet)

## headroom learn output
<!-- `headroom learn --apply` (SessionEnd hook) appends mined patterns here -->