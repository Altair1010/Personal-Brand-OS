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

- [2026-07-09] **M5 PASS** (Audience & Pillars + REVIEW GATE). Modules D.2 `audience`
  (temp 0.3, personas `.min(2).max(4)`) + D.3 `pillars` (temp 0.2, pillars `.min(3).max(5)`).
  **objectiveMix zod object built dynamically from `OBJECTIVES`** (`Object.fromEntries(OBJECTIVES.map…)`)
  — never lets LLM invent enum keys; `coerceObjectiveMix` drops stray keys on client too.
  **Ratio normalized in CODE, 3 layers, never trust LLM/client:** module `normalize` hook +
  server `savePillars` + `RatioBar` display, all via `lib/strategy-engine/normalizeRatio.ts`
  (`normalizeWeightsTo100` = largest-remainder → sum EXACTLY 100; `normalizeRatioTo100(items,key)`
  + `normalizeRecordTo100(record)`). **Review-gate persistence = `AppState.audienceApprovedAt
  DateTime?`** (migration `20260709055054_audience_approval`) — server-side, survives reload/backup;
  M6 reads it to unlock Strategy. Gate is triple-guarded: `ApproveGate` disabled until 2 checkboxes
  + saved + not dirty; server `approveAudience` re-checks **>=2 persona AND >=3 pillar** (raised from
  >=1 to match 3–5 rule); Strategy page renders locked EmptyState when `approvedAt` null (no
  auto-chain, only a manual link after approve). Editing after approve → `resetApproval()` clears
  flag. Server actions pattern (`audience-pillars/actions.ts`): diff-delete scoped by `{userId,
  goalId}` double-guard so save never touches another goal's rows. Client fetches `/api/ai/{audience,
  pillars}` only (never imports lib/ai). 19/19 tests, build 0 err, seed idempotent (PromptTemplate=3).
  QA: scope-guard 0 BLOCKER (1 WARN fixed: pillar floor) · verifier M5 DONE. Delegated across
  pbos-data-modeler (schema/seed) + pbos-prompt-engineer (D.2/D.3) + trellis-implement (engine/
  actions/routes/UI). Live D.2/D.3 smoke deferred → ToFill.md §3.

- [2026-07-09] **M6 PASS** (Strategy Builder 30d + Versioning + Export). **Layered generation
  anti-truncation** = the load-bearing pattern: D.4 `strategy` (temp 0.3) emits ONLY the month
  frame (`contentRatio`, `weeklyThemes` forced `z.array(...).length(5)`, ctaPlan/topicMap/kpi/doNot),
  NEVER dailyPlans; D.6 `weekly-plan` (temp 0.3) runs **5 separate `runModule` calls** inside server
  action `generateStrategy` (`daysInWeek=DAYS_PER_WEEK[i]`), one week failing → return early, never
  persist a partial version. `lib/strategy-engine/assembleStrategy.ts` merges in CODE:
  `DAYS_PER_WEEK=[7,7,7,7,2]` (TOTAL 30), **dayIndex continuous 1..30** (not per-week reset), pillar
  **name→id** map, objective outside `OBJECTIVES` → fallback `"educate"` (keeps 30-day invariant; rarely
  hits since D.6 output already `z.enum(OBJECTIVES)`). `lib/strategy-engine/versioning.ts`
  `createStrategyVersion`: **empty reason → throw** (hard invariant), `version = max+1` never deletes
  old, sets `AppState.activeStrategyId` + links `aiPromptRunId`, writes WeeklyPlan+DailyPlan in one
  `db.$transaction`. D.7 `content-idea` = **prompt-only, NO route** (M7 Studio consumes). Export:
  `lib/import-export/markdown.ts` `strategyVersionToMarkdown` (all fields, keeps unknown ratio keys) +
  `app/api/export/route.ts` writes ExportHistory; client downloads .md via Blob. **AI orchestration
  lives in the server action calling `runModule` directly (no HTTP round-trip);** the `/api/ai/strategy`
  + `/api/ai/weekly-plan` routes exist per milestone file-list but are pass-through, unused by main flow
  (scope-guard WARN, acceptable). UI DTO fully serializable (`createdAt.toISOString()`, Json parsed via
  type guards `asRatio`/`asCtaPlan`/`asTopicMap`/`asStringArray`, no `any`). Seed +3 PromptTemplate
  (strategy/weekly-plan/content-idea) → PromptTemplate=6. build 0 err · vitest 22/22 · seed idempotent.
  QA: scope-guard 0 BLOCKER · trellis-check 0 issue · verifier M6 DONE. Live D.4/D.6 smoke → ToFill.md §3.

- [2026-07-10] **M7a PASS (partial M7 — AI + engine only).** D.8 `post-writer` / D.9 `hook` /
  D.10 `cta` / D.11 `tone` modules + 4 pass-through routes + engine. **Gotcha (reusable): `runModule`
  does NOT sanitize centrally** — its header comment "sanitizeExternal handled in buildUser input"
  means each PromptModule must wrap external free-text itself. `sanitizeExternal(text, source)` needs
  a mandatory `source: "upload"|"paste"`; wrapped tone.text + post-writer idea/cta with `"paste"`
  (pattern = `lib/prompts/brand-dna.ts:93`). Enum-output fields all `z.enum(constants)`.
  `lib/content-engine/approveDraft.ts` = the attribution enforcer: `$transaction`, **THROWS unless
  BOTH** `strategyVersionId` (latest version of `AppState.activeStrategyId`) AND `dailyPlanId`
  (draft→contentIdea→dailyPlanId) present — no partial-attribution Post; mirrors analytic dims onto
  Post; 1 Post/draft via `contentDraftId @unique` guard. `draftVersioning` bumps `version=max+1`.
  Seed +4 PromptTemplate → total 10. NO migration (ContentDraft/Post/MetricSnapshot already complete).
  build 0 err · vitest 43/43 (9 files) · seed idempotent. scope-guard 0 BLOCKER. **7b (Studio/Calendar
  UI + studio/actions.ts) NOT done** — separate session, owner trellis-implement.

- [2026-07-10] **M7 FULL DONE** (commit `30c645d`, master — 7b UI phiên). Studio/Calendar UI:
  `studio/actions.ts` server action (getStudioData/getDraft/getCalendarData/createDraftFromIdea/
  saveDraft/approveDraftAction) mirrors `strategy/actions.ts` (USER_ID="local", ActionResult,
  serializable DTO). **saveDraft splits writes:** `bumpDraftVersion` handles content (hook/body/
  ending/hashtags/imageSuggestion/contentMarkdown) only; analytic dims (objectiveKey/hookStyle/
  ctaIntensity/format/framework/topic) updated via separate `db.contentDraft.update` **because dims
  are z.enum-guarded at the action layer** (out-of-enum → field dropped, no garbage saved). Approve
  goes ONLY through `content-engine/approveDraft` — UI surfaces the invariant throw (missing
  strategyVersionId/dailyPlanId) as ErrorState, never swallows. AI from client = `fetch("/api/ai/
  {post-writer,hook,cta,tone}")` only, never imports lib/ai. Editor = 3 `Textarea` Hook/Body/Ending
  (plain text, no TipTap); `DraftEditor` guards AI-output enums client-side via `inEnum(TUPLE, v)`.
  **BLOCKER caught by scope-guard & fixed here (recurrence of the M7a gotcha):** `lib/prompts/
  hook.ts` + `cta.ts` were still interpolating user-controlled fields (topic/persona/goal/offer)
  WITHOUT `sanitizeExternal` — the M7a note only covered post-writer/tone. Wrapped all with
  `sanitizeExternal(...,"paste")`. **Lesson: every PromptModule.buildUser touching external text
  must sanitize; there is no central guard — audit hook/cta-style list modules explicitly.** No
  migration. build 0 err · vitest 43/43 · seed idempotent (PromptTemplate=10). Gate: scope-guard 0
  BLOCKER → trellis-check PASS → milestone-verifier M7 DONE (6 VERIFY + feature-spec #5). Live
  D.8–D.11 smoke (needs key) → ToFill.md §3.

- [2026-07-10] **M8 DONE** (Performance Lab — manual tối giản). No migration (MetricSnapshot/
  PerformanceInsight/Post-dims already complete). D.14 `lib/prompts/performance.ts` (temp 0.2,
  `data analyst`): output enum `scope`/`confidence` = `z.enum` in-module (INSIGHT_SCOPES/
  INSIGHT_CONFIDENCE); objective/pillar/hook/cta/format are INPUT **data** (plain `z.string()`, NOT
  z.enum — they're describing, not producing enums); every insight.finding needs evidence (`.min(1)`).
  **Key pattern: `normalize(o:O)=>O` has NO access to input, so the "<3 posts → confidence=low" rule
  can't live in normalize** — extracted a pure `enforceLowConfidence(out, postCount)` exported from
  the module, called in the server action AFTER runModule (where postCount is known) + unit-tested
  directly. buildUser wraps every external field (period + per-post labels) in `sanitizeExternal(...,
  "paste")` (M7 lesson: no central guard). Engine `lib/performance-engine/`: `computeDaysSincePost(
  {publishedAt,createdAt},now?)` = `max(0, floor((now-(publishedAt??createdAt))/86_400_000))`;
  `aggregate(PerfPost[])` groups by pillar/hook/cta/format (count all, avg only posts WITH metrics,
  drop null-dim groups); `buildInsightInput` maps only posts with metrics → D.14 input. Server action
  `performance/actions.ts` (mirror studio/actions): `getPerformanceData` (Post+metrics+pillar id→name
  → rows+aggregates+latestInsights), `saveMetric` (zod int≥0, **upsert on @unique postId** = 1 snap/
  Post, computes daysSincePost in code), `runInsight` (calls `runModule` directly per M6 — no HTTP;
  runModule does NOT expose promptRunId so `aiPromptRunId` stays null; deletes old insights then batch-
  creates, `evidence` stored as Json `{text}`). UI: MetricInlineTable (inline number inputs + FB metric
  labels + per-row save via useTransition/router.refresh), PerformanceCharts (**recharts** BarChart,
  client, avgReach+avgEngagement per dim, hides empty groups), Pillar/HookPerfTable, LatestInsightCard
  (Sinh insight button → runInsight, confidence Badge amber/emerald, AiLoading while pending). Client
  imports server action + types ONLY, never lib/ai. Seed +1 PromptTemplate(performance) → **total 11**.
  Prereq: `npm i recharts`. build 0 err · vitest **52/52** (11 files, +9: performance.test.ts +
  computeDaysSincePost.test.ts) · seed idempotent (11 both runs) · scope audit clean (no client lib/ai,
  no hardcoded model). Live D.14 smoke (needs key) → ToFill.md §3. Delegated D.14 prompt →
  pbos-prompt-engineer, engine → trellis-implement; action/UI/tests done inline.

- [2026-07-10] **M9 DONE** (Weekly Review / Revision Engine — nhẹ). No migration (schema đủ).
  D.15 `lib/prompts/revision.ts` (temp 0.3, strategist): output `reasonForNewVersion =
  z.string().min(1)` + `adjustmentPlan[].{change,reason}` `.min(1)` — reason ép ở SCHEMA;
  `revisedContentRatio` normalize về 100 trong `normalize()` qua `normalizeRecordTo100`
  (không tin LLM). Input `versionPerf[]` = attribution compare (postCount/avgReach/avgEngagement
  theo version). buildUser bọc mọi external (insights finding/evidence/recommendation, goal,
  weeklyThemes serialize) `sanitizeExternal(...,"paste")` (M7 lesson: no central guard).
  **Load-bearing pattern `lib/strategy-engine/applyRevision.ts`:** KHÔNG tự ghi StrategyVersion
  — tái dựng `tier1: StrategyOutput` (Json fields version cũ, override `contentRatio =
  revisedContentRatio`) + `assembledWeeks` (clone từ `version.weeklyPlans.dailyPlans` cũ) rồi
  gọi lại `createStrategyVersion` (giữ mọi invariant: version=max+1, reason-throw, set
  activeStrategyId, không xóa cũ). **PHẢI clone WeeklyPlan+DailyPlan** vì `getCalendarData` +
  `approveDraft` đọc version MỚI NHẤT (`findFirst orderBy version desc`) — version rỗng làm
  Calendar trống + lệch attribution. reason non-null enforced 3 lớp: schema `.min(1)` →
  repairOnce → createStrategyVersion throw. `lib/strategy-engine/ruleWarnings.ts` = pure
  `(PerfPost[])=>string[]` (quá bán hàng ≥40% conversion; pillar yếu avgEngagement <0.5×trung
  vị; reuse `aggregate`). Server action `review/actions.ts` (mirror performance/actions): 2 bước
  **generate (không ghi DB) → apply** (review-gate style, không auto-chain); `runModule` gọi trực
  tiếp (M6 pattern, no HTTP); `getReviewData.versionPerf` group Post theo strategyVersionId.
  `goal.description` map từ `Goal.mainMessage` (schema Goal KHÔNG có field description).
  UI: `review/page.tsx` (server) → `components/review/ReviewPanel.tsx` (client) +
  `WeeklyAdjustmentCard`/`RevisionDiff`; Dashboard nhúng card qua `getLatestAdjustment()`
  (chỉ khi ≥2 version). Client CHỈ gọi server action, không import lib/ai. `app/api/ai/revision/
  route.ts` = pass-through (đủ file-list, flow chính dùng action; scope-guard WARN chấp nhận
  như M6). Seed +1 PromptTemplate(revision) → **total 12**. build 0 err · vitest **61/61**
  (13 files, +2: revision.test.ts 5 + ruleWarnings.test.ts 4) · seed idempotent 12/12. Gate:
  scope-guard 0 BLOCKER · milestone-verifier M9 DONE (VERIFY + feature-spec #7). Live D.15 smoke
  (needs key) → ToFill.md §3. Delegated: pbos-prompt-engineer (D.15) · pbos-data-modeler
  (applyRevision + seed) · trellis-implement (ruleWarnings + actions/UI).

- [2026-07-10] **M10 DONE** (Settings + Backup + Polish — web MVP mốc cuối). No migration
  (AIModelConfig/ExportHistory đủ field). **seedCore refactor:** tách toàn bộ logic upsert
  canonical từ `prisma/seed.ts` → `prisma/seedCore.ts` export `seedCore(db, domain)` với type
  `SeedDb = PrismaClient | Prisma.TransactionClient` (nhận CẢ tx client → reset dùng lại trong
  `$transaction`); seed.ts còn mỗi CLI entrypoint (parseDomain + new PrismaClient + gọi seedCore).
  Idempotent giữ nguyên (upsert stable key, PromptTemplate=12). **Backup `lib/import-export/
  backup.ts`:** `exportBackup(db)` dump 22 bảng → `{version:1,exportedAt,data:{model:rows}}`;
  `backupEnvelopeSchema` zod validate CẤU TRÚC (không validate field — mục đích chặn file sai
  trước khi ghi); `importBackup(db,env)` = `$transaction` upsert theo `IMPORT_ORDER` (parent trước,
  **preserve cuid/natural key** → FK khớp); `wipeAll(tx)` deleteMany theo `RESET_ORDER` (reverse).
  **FK gotcha (data-modeler bắt được):** `PromptRun` phải upsert SỚM (ngay sau PromptTemplate),
  KHÔNG để cuối — vì `StrategyVersion/ContentDraft/PerformanceInsight.aiPromptRunId` là FK trỏ
  PromptRun (SetNull); để cuối → child ghi FK trước khi parent tồn tại → vỡ transaction SQLite.
  Date round-trip: export trả Date objects; JSON.stringify→parse thành ISO string; importBackup
  ghi as-is, **dựa Prisma tự coerce string→DateTime** (không `new Date()` thủ công). **Settings
  UI (server-action-only, client KHÔNG import lib/ai/backup/prisma):** `settings/actions.ts`
  `getSettingsData` (active = try/catch `resolveModelConfig()` → null khi throw), `saveModelConfig`
  (zod `provider:z.enum(["anthropic","openai"])` — 2 provider adapter hỗ trợ; **model = free-text,
  KHÔNG hardcode**; `$transaction` unset mọi isDefault cũ rồi create default mới = DUY NHẤT 1
  default; resolveModelConfig đọc isDefault → đổi model tự áp dụng), `deleteModelConfig`,
  `resetDatabase(confirmText)` (**server RE-CHECK `confirmText==="RESET"`** trước khi wipe →
  `wipeAll(tx)`+`seedCore(tx,"khang-guru")` 1 transaction). `api/backup/route.ts` GET=export+ghi
  ExportHistory{kind:"backup"}+Content-Disposition; POST=`safeParse`→400 "File backup không hợp lệ"
  KHÔNG chạm DB nếu sai, else importBackup try/catch→500. DangerZone 2 lớp (gõ "RESET" bật nút +
  window.confirm). **Polish states = 2 file cấp group phủ CẢ 10 trang:** `app/(dashboard)/loading.tsx`
  (AiLoading) + `error.tsx` ("use client" boundary → ErrorState onRetry=reset). Studio EmptyState
  **đã có sẵn** trong `components/content/StudioList.tsx` (không sửa page — explore ban đầu nhầm).
  Test `tests/import-export/backup.test.ts`: round-trip trên **SQLite temp thật** (`prisma db push`
  file `prisma/test-backup.db` riêng, PrismaClient `datasources.db.url` explicit — KHÔNG dùng
  lib/db singleton; seedCore→export→mutate(đổi name+xóa framework)→**guard mutation landed**→import
  →assert row-count+field khớp; afterAll rmSync). build 0 err · **vitest 67/67 (14 file, +6)** · seed
  idempotent 12/12. Gate: scope-guard 0 BLOCKER · milestone-verifier M10 DONE (feature-spec #8 đủ).
  Delegated: pbos-data-modeler (seedCore+backup) · trellis-implement (actions/UI/route/polish/README)
  · agent-skills:test-engineer (round-trip test). **Web MVP M0–M10 khép kín — còn desktop M11+M12.**

- [2026-07-11] **M11 DONE** (Desktop runtime cross-platform — Electron production boot).
  `next.config.ts` +`output:'standalone'` (giữ `serverExternalPackages`) → `next build` sinh
  `.next/standalone/server.js` + traces `@prisma/client`/`.prisma/client` (query_engine DLL 20MB)
  + pdf-parse/pdfjs-dist/mammoth vào `standalone/node_modules` (không cần asarUnpack cho unpackaged
  test; M12 lo packaged). **`electron/main.js` rẽ 2 nhánh:** dev = `startNextDev` (spawn `next dev`,
  BYTE-FOR-BYTE như Phase A — dev path giữ nguyên) · prod = `startNextProd` khi `app.isPackaged ||
  argv.includes('--prod')`. **`electron/runtime.js` (NEW) = env/path plumbing thuần:** `isProd`,
  `resolveDatabaseUrl` (dev→`file:prisma/dev.db` unchanged · prod→`file:<app.getPath('userData')>/
  pbos.db`, mkdir recursive), `loadUserEnv` (parse `userData/pbos.env` KEY=VALUE, strip quote/#;
  thiếu file→`{}`, app vẫn boot, AI báo "thiếu key" — **KHÔNG đọc repo `.env`**, rule 3),
  `prepareStandaloneAssets` (Next standalone KHÔNG tự copy `.next/static`+`public` → `fs.cpSync` cạnh
  `server.js`; skip khi `app.isPackaged`), `firstRunSetup` (spawn `migrate deploy` LUÔN idempotent +
  seed CHỈ khi `dbExistedBefore=false` — chạy TRƯỚC khi mở window; migrate fail→dialog.showErrorBox+
  quit, không mở window trắng). **Spawn = `process.execPath` + `ELECTRON_RUN_AS_NODE:'1'`** cho cả
  server (`server.js`, cwd=standaloneDir, env PORT/HOSTNAME='127.0.0.1'/DATABASE_URL/NODE_ENV=production
  + injectedKeys) và migrate/seed. **Gotcha (reusable): `prisma db seed` shell ra bare `tsx` → PATH
  fail dưới Electron** (giống M2 `npx prisma` fail); fix = spawn `node_modules/tsx/dist/cli.mjs
  prisma/seed.ts` trực tiếp. **Prisma CLI (`node_modules/prisma/build/index.js`) tự nạp repo `.env`
  lúc migrate** nhưng ta truyền `DATABASE_URL` explicit → dotenv KHÔNG override (default) → migrate
  đúng userData DB, không đụng dev.db. package.json +`build:desktop`(`next build`) +`app:prod`
  (`electron electron/main.js --prod`). **Verify không cần GUI (headless):** migrate deploy→2
  migration applied · seed qua tsx→6 ContentObjective/4 Framework/AppState/AIModelConfig · boot
  `server.js` thật→HTTP 200 `/`+`/settings` · `/api/backup` (đọc DB) trả seeded "Khang Guru" =
  Prisma client+engine trong standalone query đúng DB userData-relocated. vitest **67/67** 0
  regression. Gate: scope-guard PASS 4/4 (rule-3 `.env` sạch, 0 hardcoded path/model, DB behind
  DATABASE_URL, 0 entity/feature creep). **GUI boot cũng verify:** `npm run app:prod`→Electron mở,
  first-run migrate+seed chạy, server ready 200, DB ghi `%APPDATA%\Roaming\Electron\pbos.db` (299KB) —
  userData='Electron' khi unpackaged (M12 packaged→productName). **Full gate M11 PASS.**
  **M12 TODO đã note trong code:** packaged build cần bundle tsx+seed+prisma CLI qua extraResources
  (`runtime.js` schemaDir=root chỉ đúng cho unpackaged).

- [2026-07-11] **M12 DONE** (Packaging unsigned — electron-builder@25). **`runtime.js resolvePaths`
  fix:** đổi `root`→`base` cho `prismaCli/tsxCli/seedScript/schemaDir` (base=`process.resourcesPath`
  khi packaged, else repo root → unpackaged BYTE-IDENTICAL M11); thêm `prismaEngineLib`
  (`base/node_modules/.prisma/client/query_engine-windows.dll.node`) + `firstRunSetup` set
  `PRISMA_QUERY_ENGINE_LIBRARY` cho seed spawn CHỈ khi file tồn tại (Windows; Mac tên khác→Prisma
  co-located resolution tự lo). **`electron-builder.yml`:** asar CHỈ chứa Electron shell; `asarUnpack:
  []`; **mọi spawn-target ra `extraResources`** (child_process.spawn KHÔNG với tới trong app.asar):
  `.next/standalone` (server+traced node_modules), `prisma/{schema,seed.ts,seedCore.ts,migrations}`,
  `node_modules/{prisma(build+*.node),@prisma/engines(*.node+*.exe),@prisma/client,.prisma/client,
  tsx(dist),esbuild,@esbuild}`. **Gotcha (reusable): seed `import @prisma/client` resolve từ
  `resourcesPath/node_modules`, KHÔNG chui vào standalone subtree** → phải copy `@prisma/client` +
  `.prisma/client` (engine) ra extraResources riêng. **Pre-step `scripts/prepare-package.js`:**
  pre-nest `.next/static`+`public` vào `.next/standalone/{.next/static,public}` (packaged bỏ qua
  `prepareStandaloneAssets`; server.js kỳ vọng cạnh nó). **Icons:** `scripts/make-icons.js` sharp→
  `build/icon.png` 1024 placeholder; **electron-builder tự sinh .ico/.icns từ png** (bỏ icon-gen —
  bundled sharp lỗi libvips "space 32"; bỏ @shockpkg/icon-encoder — ico 256 fail check). `win.icon/
  mac.icon = build/icon.png`. **`.gitignore` dòng `/build` che icons** → thêm `!/build/` +
  `!/build/icon.png`. **CI `.github/workflows/desktop-build.yml`:** trigger tag `v*`, job
  windows-latest→.exe + macos-latest→.dmg, upload-artifact. **Local build gotcha (reusable, chỉ
  Windows non-elevated):** electron-builder tải `winCodeSign-2.6.0.7z` chứa darwin dylib SYMLINK →
  7za fail "A required privilege is not held" (thiếu SeCreateSymbolicLinkPrivilege khi không bật
  Developer Mode/không admin) → extract fail exit 2, không rename temp→stable, tải lại vô hạn. **Fix:**
  giải nén tay `winCodeSign-2.6.0.7z` (bất kỳ, đều cùng nội dung) vào
  `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0` với `-xr!darwin`, xoá temp
  numeric dir → electron-builder thấy stable dir, skip download. **GitHub Actions windows runner chạy
  admin → symlink OK, CI KHÔNG cần workaround.** File lock `xmlbuilder` (EnsureEmptyDir) khi build lại
  đè lên `release/` cũ → `rm -rf release` trước khi retry. **Verify:** installer `Personal Brand OS
  Setup 0.1.0.exe` **187.7M** · 14/14 spawn-path tồn tại trong `win-unpacked/resources` · vitest 67/67
  · scope-guard PASS 4/4. GUI install/launch + Mac .dmg CI = user tự làm (ToFill §4).
  **[fix sau đóng gói lần đầu — bắt bởi automated packaged smoke]:** first-run SEED packaged vỡ vì
  `prisma/seedCore.ts` phụ thuộc `../lib/constants` (OBJECTIVES/OBJECTIVE_COLORS) + đọc
  `readFileSync(__dirname/../data/seed/<domain>.json)` — cả hai KHÔNG được ship (M11 unpackaged seed
  từ repo root nên không lộ). Và `require('@prisma/engines')` cần package JS + sibling
  `@prisma/get-platform`/`debug` (filter cũ chỉ chép binary → MODULE_NOT_FOUND). **Fix extraResources:**
  thêm `lib/constants.ts` + `data/seed/**`; ship **cả scope `node_modules/@prisma/**`** (hết
  whack-a-mole transitive require). **Automated packaged smoke (reusable, KHÔNG cần GUI/key):** chạy
  `electron.exe` với `ELECTRON_RUN_AS_NODE=1` trên `release/win-unpacked/resources` — migrate deploy
  (packaged prisma CLI) → seed (packaged tsx+seed.ts, DATABASE_URL=temp) → boot `.next/standalone/
  server.js` → curl `/`=200 `/settings`=200 `/api/backup`="Khang Guru". Chứng minh chuỗi runtime
  packaged chạy thật TRƯỚC khi user cài. Installer sau fix = **199.8M**.

## Desktop (M11 + M12) — scope & quyết định [2026-07-11]
Desktop tách 2 mốc (viết ở `docs/milestones.md` PHẦN 3B). Web M0–M10 vốn cross-platform (audit path
sạch: mọi path qua `path.join/resolve`+`__dirname`, 0 hardcoded `C:\`/`/Users/`; DB qua `DATABASE_URL`).
`electron/main.js` hiện = dev window (spawn `next dev`), main=electron/main.js, script `app`.
- **M11 runtime:** main.js `next dev`→production (Next `output:'standalone'` + Electron node
  `ELECTRON_RUN_AS_NODE=1`); DB→`app.getPath('userData')`; first-run `migrate deploy`; key runtime.
- **M12 packaging:** electron-builder — Win `nsis` `.exe` (shortcut+icon, build local) + Mac `dmg`
  (build qua GitHub Actions `macos-latest`, KHÔNG cross-build từ Win). **Unsigned** (chốt với user:
  chấp nhận SmartScreen/Gatekeeper). asarUnpack Prisma engines + pdf-parse/pdfjs-dist/mammoth.
- **User action (ToFill.md):** tạo GitHub repo + push remote để chạy Mac CI (repo chưa có remote).

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

- [2026-07-11] **EM1 PLANNED** (approved extension beyond MVP lock — plan file
  `~/.claude/plans/4-c-i-exe-majestic-hinton.md`; milestones.md PHẦN 4). Split into
  **EM1a→EM1b→EM1c**, order-locked (EM1c needs EM1b account). Durable decisions:
  1. **Content-gen = template + inject** (confirmed from code, NOT changed): static
     `system`+few-shot in `lib/prompts/<module>.ts` + user data via `buildUser()`. No
     user-authored prompts; LLM never sets enums. EM1a only surfaces this to the user.
  2. **API key moves into Settings** (EM1a): `AIModelConfig.apiKey` col; adapter uses
     `config.apiKey ?? process.env.*` (env fallback kept). Model = **preset dropdown**
     (`lib/ai/models.ts`, Claude/GPT + level Low/Med/High/Extra) — preset is config DATA,
     still no hardcoded model in the call path (rule 3 intact). Key encryption: Electron
     `safeStorage` if available, else plaintext in local `userData` SQLite (single-user
     desktop — accepted trade-off). Replaces manual `pbos.env` step (ToFill M11/M12).
  3. **Persistence = local SQLite + cloud backup snapshot** (option B, chosen over
     cloud-primary Postgres): keep SQLite, add **Supabase** (free) Auth + Storage. Push
     **encrypted** snapshot (reuse `lib/import-export/backup.ts`), pull on new machine.
     Rejected cloud-primary (needs online, sqlite→postgres refactor, free-tier limits).
     Snapshot **excludes secrets** (apiKey, FB token) → re-enter on new machine.
  4. **Facebook = paste Page Access Token → Graph API fetch** (EM1c), NOT full OAuth:
     own-page token needs no app review. Manual metric entry = **paste post URL** →
     `resolvePostId` → Graph insights → `MetricSnapshot(source="facebook_api")`; typing
     4 fields stays as fallback. `FacebookAccount` scoped to account; `Post.facebookAccountId`.
  5. **New hard rule:** secrets never enter cloud backup (RULES.md). EM1 loosens scope-lock
     items (auth/cloud, Meta/FB API, key-in-UI) — logged as approved exception, not drift.

- [2026-07-11] **EM1a DONE** (gate PASS: build 0-err, vitest 70/70 incl new
  `tests/ai/adapter-db-key.test.ts`, seed idempotent, scope-guard PASS). Deltas vs plan:
  1. **Keystore = Node crypto AES-256-GCM** (NOT plaintext fallback — user decision
     2026-07-11): `lib/ai/keystore.ts` `encryptString`/`decryptString`. Per-install secret
     `crypto.randomBytes(32)` at `<userData>/.pbos-key` (0o600), userData dir derived from
     `DATABASE_URL` dir, dev fallback `prisma/.pbos-key`. Prefix scheme: `v1:` = crypto
     (base64 iv|tag|ciphertext), `ss1:` = Electron safeStorage (tried only if genuinely
     available). Malformed/missing key → clear throw, never crash pipeline. Reason:
     `safeStorage` unreachable from the `ELECTRON_RUN_AS_NODE` Next server child.
  2. **Presets** (`lib/ai/models.ts`, `MODEL_PRESETS` + `findPreset`/`isPresetModel`):
     anthropic claude-haiku-4-5 (Low) / claude-sonnet-4-6 (High) / claude-opus-4-8 (Extra);
     openai gpt-4o-mini (Low) / gpt-4o (Medium) / gpt-4.1 (High). DATA only, referenced
     just inside models.ts — no model literal in call path (adapter/anthropic/openai/run).
  3. **Key never leaves server**: `AiModelConfigDTO` exposes `hasKey: boolean` only
     (`getSettingsData` maps `!!r.apiKey`); `saveModelConfig` encrypts before DB write;
     form field is write-only password + show/hide. Adapter: `config.apiKey ?? process.env.*`.
  4. **Help-icon infra**: `components/ui/tooltip.tsx` (+`@radix-ui/react-tooltip`),
     `components/ui/field-help.tsx` (`FieldHelp` + `LabelWithHelp` drop-in), `lib/help-text.ts`
     (VN map). Applied ≥1 field on BrandDnaForm/GoalForm/PersonaEditor/DraftEditor/AiModelConfigForm.
  5. **Transparency**: `components/settings/ContentGenInfoPanel.tsx` (collapsible,
     `@radix-ui/react-collapsible`, `components/ui/collapsible.tsx`) + `docs/content-gen-transparency.md`
     — describes real 6-step pipeline, mechanism unchanged.
  Migration `20260711024222_aimodelconfig_apikey` (`ALTER TABLE AIModelConfig ADD apiKey TEXT`).

- [2026-07-11] **EM1b DONE** (Tài khoản Supabase + backup cloud mã hoá). Gate PASS: build
  0-err, vitest **77/77** (+7 `tests/cloud-backup/cloud-backup.test.ts`), seed idempotent
  (migration `appstate_supabase_binding` additive-only), scope-guard 0 violation, verifier DONE.
  Chia 2 phiên/commit: `EM1b-1: auth gate` (e5a0367) + `EM1b: account + cloud backup sync`.
  **Quyết định load-bearing:**
  1. **Snapshot mã hoá bằng PASSPHRASE (scrypt), KHÔNG dùng `lib/ai/keystore.ts`.** keystore
     dùng secret per-install `<userData>/.pbos-key` → máy mới KHÔNG có secret đó → snapshot
     bất khả giải mã ⇒ vỡ mục tiêu khôi phục. `lib/cloud-backup.ts` tự derive:
     `scryptSync(passphrase, salt, 32)` + AES-256-GCM, blob = `MAGIC("PBOS1")|salt(16)|iv(12)|
     tag(16)|ct`. Passphrase KHÔNG lên cloud; sai passphrase → GCM auth fail → throw.
  2. **Secret loại khỏi snapshot qua `STRIP_FIELDS`** = `{AIModelConfig:["apiKey"],
     AppState:["supabaseUserId"]}` (EM1c thêm `FacebookAccount:["accessToken"]`). `stripSecrets`
     deep-clone + null field (giữ row). `supabaseUserId` strip để restore KHÔNG đè binding máy
     mới. Tái dùng NGUYÊN `lib/import-export/backup.ts` (export/import/`backupEnvelopeSchema`) —
     không sửa. `pushSnapshot` = export→strip→encrypt→Storage upload upsert `<userId>/latest.enc`;
     `pullSnapshot` = download→decrypt→`safeParse`(chặn file hỏng TRƯỚC ghi DB)→importBackup.
  3. **Supabase server-side KHÔNG service key.** `lib/cloud-backup/actions.ts` build client =
     anon key + `global.headers.Authorization: Bearer <accessToken>` (token client truyền vào),
     RE-VERIFY `auth.getUser(token)` trước mọi Storage op → RLS `(storage.foldername(name))[1] =
     auth.uid()` giới hạn user chỉ đụng thư mục mình. Gate UI là UX, verify token là biên bảo mật.
  4. **Hard gate client-side (không middleware).** App single-user Electron/standalone → tránh
     middleware. `components/auth/AuthGate.tsx` (client) bọc `AppShell` trong MỚI
     `app/(dashboard)/layout.tsx`; root `app/layout.tsx` BỎ AppShell (chỉ Providers); group
     `(auth)` (login/signup + `AuthForm` dùng chung) ngoài gate, layout tối giản. AuthGate:
     `getSession`+`onAuthStateChange` → authed render children + `bindAccount(user.id)`; unauthed
     → `router.replace("/login")`; config thiếu → màn "Chưa cấu hình Supabase".
  5. **Config Supabase qua env, KHÔNG NEXT_PUBLIC.** `SUPABASE_URL`/`SUPABASE_ANON_KEY` đọc
     `process.env` (dev `.env`; prod `pbos.env` — `loadUserEnv` parse mọi KEY=VALUE nên KHÔNG
     cần sửa `electron/runtime.js`). Client lấy runtime qua server action `getSupabaseConfig()`
     (anon key publishable, an toàn lộ renderer); `lib/supabase.ts` lazy-cache browser client,
     cache chỉ khi thành công (typo config retry được sau khi user sửa).
  6. **`bindAccount` chống đè chủ khác:** chỉ ghi `AppState.supabaseUserId` khi null; nếu đã có
     và KHÁC user hiện tại → trả `mismatch`, không overwrite.
  Migration `20260711041623_appstate_supabase_binding` (+`supabaseUserId String?` +
  `lastCloudSyncAt DateTime?`). Dep +`@supabase/supabase-js`. Live push/pull (cần Supabase
  project + private bucket `backups` + RLS) → ToFill §5. Delegated: pbos-data-modeler (schema/
  migration), scope-guard + milestone-verifier (gate); code/UI/test inline.

- [2026-07-11] **EM1c DONE** (Đa trang Facebook + Performance Lab tự fetch). Gate PASS: build
  0-err, vitest **89/89** (+10 `tests/facebook/graph.test.ts`, +2 strip FacebookAccount token),
  seed idempotent 3×, migration `20260711082356_em1c_facebook` additive-only, scope-guard 0
  violation, verifier DONE. 1 phiên (không cần chia). Delegated: pbos-data-modeler (P1 schema),
  trellis-implement (P2/P4/P5 actions+UI), scope-guard + milestone-verifier (gate); graph lib +
  fix inline. **Quyết định load-bearing:**
  1. **Chỉ Page Access Token dán tay — KHÔNG OAuth/app-review.** Page user tự admin → không cần
     app review. `lib/facebook/graph.ts` (fetch injectable để test): `resolvePostId(url)` parse
     3 dạng URL → `{pageId}_{postId}` (pfbid không resolve → lỗi typed); `verifyPageToken` (khi
     kết nối); `fetchPostInsights` **1 call gộp** field-expansion. `GRAPH_VERSION="v23.0"` đặt 1
     chỗ (post_impressions_unique deprecate từ v26 → field lỗi coi null).
  2. **Map metric + fallback null:** reach=`post_impressions_unique`, engagement=`post_engaged_users`
     (fallback reactions+comments+shares), comments=`comments.summary.total_count`,
     shares=`shares.count`(vắng→0), **saves=`post_activity_by_action_type.save` thường vắng cho
     post → null** → user nhập tay bù. Lưu full JSON vào `MetricSnapshot.fbRawResponse`. Mapping
     đầy đủ: `research/graph-api-mapping.md`.
  3. **Token FB tái dùng `lib/ai/keystore` encryptString/decryptString** (AES-256-GCM/safeStorage),
     lưu `FacebookAccount.accessToken` ciphertext; decrypt chỉ trong action `"use server"`; KHÔNG
     trả client (`listFacebookAccounts` select id/pageId/pageName), KHÔNG log. Strip khỏi cloud
     backup: `STRIP_FIELDS.FacebookAccount=["accessToken"]` (khớp seam EM1b), test phủ.
  4. **`source` là source-of-truth từ constants:** `METRIC_SOURCES=["manual","facebook_api"]`;
     `const [SOURCE_MANUAL, SOURCE_FACEBOOK]=METRIC_SOURCES` — không rải literal. Auto-fetch upsert
     **1 MetricSnapshot/Post** (`where{postId}`, `source=facebook_api`,`postUrl`,`fbRawResponse`,
     `fetchedAt`); manual `saveMetric` giữ nguyên `source=manual`. Field null vẫn ghi (Int? cho phép).
  5. **Switcher scope qua URL `?fb=`, không middleware.** `lib/stores/facebook.ts` (Zustand
     `activeFacebookAccountId`) + `components/layout/AccountSwitcher.tsx` (native select, phải
     Topbar — Topbar là client nên tự fetch qua action, không truyền prop từ server). Đổi trang →
     `router.push('/performance?fb=<id>')`; `page.tsx` đọc `searchParams.fb` → `getPerformanceData
     (facebookAccountId?)` thêm `where.facebookAccountId` khi non-null (null = tất cả trang).
  Schema: `FacebookAccount`(ownerRef@default"local",`@@unique([ownerRef,pageId])`) + `Post.
  facebookAccountId?`(FK SetNull) + `MetricSnapshot`(+postUrl/fbRawResponse/fetchedAt). Live smoke
  (cần FB Developer App + Page token dài hạn) → ToFill §5, deferred (user).

- [2026-07-12] **EM2a DONE** (3 repo integrations). Gate PASS: build 0-err, vitest **92/92**
  (+3 `tests/ai/structured-adapter.test.ts`), scope-guard 2 finding đã fix. Commit `EM2a:`.
  EM2 = mở rộng có phê duyệt vượt MVP lock (giống EM1) — plan `~/.claude/plans/
  c-3-repo-u-delightful-frog.md`. Quyết định load-bearing:
  1. **Vercel AI SDK `generateObject` = seam bổ sung, KHÔNG thay text path.** Thêm method
     optional `callStructured` vào interface `AIAdapter` (`lib/ai/adapter.ts`); real adapter
     (`anthropic.ts`/`openai.ts`) implement qua `generateObject({model,schema,system,prompt,
     maxOutputTokens,temperature})` — GIỮ NGUYÊN `call` (raw fetch, proven). `lib/ai/run.ts`
     ưu tiên `callStructured` khi có, else fallback text→safeJsonParse→repairOnce (mock test chỉ
     có `call` nên 89 test cũ đi nhánh text, xanh nguyên). **Re-validate `outputSchema.safeParse`
     trên `res.object` TRƯỚC normalize** (defensive: mock adapter trả object verbatim, prod thì
     generateObject đã validate — vẫn safeParse để enum contract đúng mọi nguồn). SDK v7:
     `usage.inputTokens/outputTokens` (không phải promptTokens). NO_TEMPERATURE guard
     (opus-4-8/fable-5) port sang nhánh structured. Model vẫn từ resolveModelConfig (rule 3 giữ).
     Dep +`ai@7`, `@ai-sdk/anthropic@4`, `@ai-sdk/openai@4`.
  2. **PostPreview (mượn Postiz composer)**: `components/content/PostPreview.tsx` (new) = FB-style
     read-only, ghép hook+body+ending (`\n\n`) + hashtags, live theo state; char counter mỗi
     section trong `StructuredEditor.tsx`; wired 2 cột lg trong `DraftEditor.tsx`. Plain text,
     KHÔNG TipTap.
  3. **KpiSummary (Tremor-style tự build, 0 dep)**: `components/performance/KpiSummary.tsx` (new)
     = 4 card (tổng post, reach TB, engagement TB, pillar mạnh nhất) từ `data.rows`+`aggregates`;
     đầu `performance/page.tsx` trên PerformanceCharts. GIỮ recharts.
  **Bug scope-guard bắt (reusable):** `prisma/.pbos-key` (keystore master key AES per-install,
  dev fallback) KHÔNG được `.gitignore` → nguy cơ commit secret. Fix: thêm `.pbos-key`+`*.pbos-key`
  vào `.gitignore`. Live AI smoke (cần key) qua nhánh structured → vẫn ToFill §3.
- [2026-07-12] **EM2b DONE** (smoketest fixes T4–T8). Gate PASS: build 0-err, vitest **94/94**
  (+2 `tests/settings/set-default.test.ts`), scope-guard 0 violation. Commit `EM2b:`. Điểm
  load-bearing:
  1. **Hydration (T4):** `<Badge>` (là `<div>`) KHÔNG được lồng trong `<p>` → hydration error.
     `AiModelConfigForm.tsx` đổi `<p>` bọc badge → `<div>` (giữ class). Quy tắc chung: badge/div
     inline phải nằm trong `<div>`, không `<p>`.
  2. **Quick-create menu (T5):** `components/ui/dropdown-menu.tsx` (new, radix
     `@radix-ui/react-dropdown-menu`) — shadcn trimmed. Topbar "Tạo mới" thành dropdown 3 item
     (Bản nháp mới → `createBlankDraft` server action tạo `ContentDraft` trống rồi
     `router.push('/studio/[id]')`; Chiến lược mới → `/strategy`; Thêm persona →
     `/audience-pillars`). `createBlankDraft` (studio/actions.ts) chỉ tạo draft (contentIdeaId
     null OK), KHÔNG chạm Post/attribution.
  3. **Cloud bucket UX (T6):** `lib/cloud-backup.ts` — helper `isBucketMissing` regex
     `/bucket not found/i` trên `error.message`; push+pull ném message VN hướng dẫn tạo bucket
     `backups` thay vì lỗi thô. Không auto-create được (anon key + RLS). BackupPanel thêm hint
     setup; ToFill §5 nhấn tên bucket phải đúng `backups`.
  4. **Set-default model (T7):** `setDefaultModelConfig(id)` (settings/actions.ts) — `$transaction`:
     findUnique (không có → throw), `updateMany isDefault:false`, `update target isDefault:true`.
     KHÔNG tạo row mới. Button "Đặt mặc định" mỗi row `!isDefault`. Test hermetic: `vi.mock('@/lib/db')`
     trỏ temp PrismaClient (vi.hoisted holder) + `vi.mock('next/cache')` no-op revalidatePath →
     test server action thật trên temp SQLite (pattern tái dùng cho mọi server action đọc `db`).
  5. **Persona/pillar helpers (T8):** `lib/help-text.ts` +9 persona +4 pillar key; PersonaEditor
     FIELD_HELP phủ mọi field + placeholder ví dụ; PillarBoard đổi `Label`→`LabelWithHelp` +
     placeholder. `ReferenceSamplePanel.tsx` (new, collapsible) = mẫu Khang Guru read-only, KHÔNG
     auto-fill; wired đầu AudiencePillarsBoard.

- [2026-07-12] **EM2c DONE** (manual-edit Strategy/Calendar + Excel export). Gate PASS: build
  0-err, vitest **99/99** (+4 `tests/strategy/update-daily-plan.test.ts`, +1
  `tests/import-export/excel.test.ts`), seed idempotent (PromptTemplate=12), scope-guard 0
  BLOCKER (1 fixed), verifier DONE. Commit `EM2c:`. Load-bearing:
  1. **Manual edit = SỬA TẠI CHỖ, KHÔNG tạo version mới.** Migration additive
     `20260712060653_em2c_strategy_editedat` (`StrategyVersion.editedAt DateTime?`).
     `updateDailyPlan(dailyPlanId, {plannedObjective?,suggestedTopic?,suggestedCta?,pillarId?})`
     + `updateStrategyFrame(versionId, {contentRatio?,kpiToTrack?,doNotList?})` trong
     `strategy/actions.ts`. Cả hai CHỈ sửa version của `AppState.activeStrategyId` (guard
     `strategyId === activeStrategyId`), update DailyPlan/StrategyVersion tại chỗ + set
     `editedAt=new Date()`. **Post giữ nguyên dailyPlanId** → attribution không đổi.
     `plannedObjective` = `z.enum(OBJECTIVES)` (bỏ field nếu sai enum); `pillarId` phải thuộc
     goal active (`contentPillar.findFirst {id,userId,goalId:activeGoalId,status:active}`);
     `contentRatio` chuẩn hoá 100 bằng `normalizeRecordTo100` trong CODE (sum client bỏ qua).
  2. **DTO thêm `dailyPlanId` + `pillarId`** vào `StrategyDailyPlanDTO`, `dailyPlanId`+`suggestedCta`
     vào `CalendarDayDTO` để UI biết target id. `StrategyDTO.editedAt` hiện badge "đã chỉnh tay".
  3. **UI edit mode:** `StrategyPreview.tsx` (client) nhận thêm prop `pillars`, nút "Chỉnh sửa"
     toggle → mỗi ngày thành `DailyPlanEditRow` (native `<select>` OBJECTIVES + pillar + Input
     topic/cta + Lưu) + `FrameEditor` (6 number input ratio + textarea KPI/tránh). Sau lưu
     `router.refresh()` (state row giữ giá trị mới ngay). `DayCell.tsx` chuyển sang client, thêm
     inline edit (pencil → select objective + input topic/cta) gọi cùng `updateDailyPlan`. Không
     có `select` component trong repo → dùng native `<select>` styled như input.
  4. **Excel = exceljs@4.4** (+`serverExternalPackages:["exceljs"]`). `lib/import-export/excel.ts`
     (new): `strategyVersionToWorkbook(version)` (PURE, nhận version-with-plans như markdown.ts)
     → 6 tab **Tổng quan/Tỷ trọng/30 ngày/CTA/Bản đồ chủ đề/KPI & Tránh**; `dataReportToWorkbook(db)`
     → **Persona/Trụ cột/Chiến lược (active)/30 ngày/Bài đăng/Chỉ số** (báo cáo người-đọc-được,
     KHÔNG dump 22 bảng thô). Helper `addSheet` = header bold+fill+freeze+border. Cả 2 trả Buffer.
  5. **Routes:** `/api/export/xlsx?versionId=` (GET, T10, ghi ExportHistory{kind:"excel"}) +
     `/api/backup?format=xlsx` (GET branch, T11). Client tải bằng anchor navigation (route set
     Content-Disposition attachment). Nút "Xuất Excel" cạnh Markdown (StrategyWizard) + cạnh Backup
     (BackupPanel). **Gotcha (reusable): route trả binary phải `new NextResponse(new Uint8Array(buffer))`**
     (không truyền thẳng Buffer). **tsc gotcha:** `wb.xlsx.load(buf)` báo TS2345 vì Node
     `Buffer<ArrayBufferLike>` ≠ ExcelJS `Buffer` param → cast `buf as unknown as
     Parameters<typeof wb.xlsx.load>[0]` (Next build KHÔNG typecheck test nên build xanh, nhưng
     scope-guard chạy tsc bắt được — fix cho sạch). Pre-existing TS2352 ở
     `tests/ai/adapter-db-key.test.ts` (EM1a) không thuộc EM2c.

## Bug workaround registry
<!-- symptom -> root cause -> workaround -> permanent fix ref -->
- (none yet)

## headroom learn output
<!-- `headroom learn --apply` (SessionEnd hook) appends mined patterns here -->