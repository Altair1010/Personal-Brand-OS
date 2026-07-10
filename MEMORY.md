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
  · agent-skills:test-engineer (round-trip test). **Web MVP M0–M10 khép kín — còn M11 Electron.**

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