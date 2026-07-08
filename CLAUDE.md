# CLAUDE.md — master instructions

> **Language policy** (three separate rules — do not conflate):
> 1. **Replies to the user: ALWAYS Vietnamese**, unconditionally, with full
>    diacritics — every message you send the user, regardless of what language the
>    surrounding files are in. Only literal code identifiers, commands, and
>    verbatim quotes stay in their original form.
> 2. **Bootstrap scaffold files** — THIS file and AGENTS / MEMORY / SPEC / RULES /
>    STATE / LOOP / plan / todo — are authored in **English** for precision and to
>    match tool/agent prompts.
> 3. **Work-product files you create later** during tasks (notes, docs, commit
>    messages) default to **Vietnamese**, unless English is required: code
>    identifiers, external API field names, verbatim quotes, or when the user
>    explicitly asks for English.

---

# PHẦN A — DỰ ÁN Personal Brand OS (đặc thù)

## A.1 — Onboarding & cách vận hành

### Đọc trước khi làm
1. **`docs/milestones.md`** ⭐ — **FILE THỰC THI DUY NHẤT**. **Chỉ đọc PHẦN liên quan theo từng mốc** để tiết kiệm context.
2. `docs/product-master-plan.md` — vision, IA (8 tab), folder, UI, assumptions.
3. `docs/database-schema.md` + `prisma/schema.prisma` — data model (22 entity).
4. `docs/feature-spec.md` — acceptance từng module.

> Lưu ý: `local-development.md` và `prompt-system.md` **đã bị xóa** — nội dung nằm trong `milestones.md` (PHẦN 1 & PHẦN 2). Prompt System đã nâng cấp lên **v2** (Global Contract, self-check, few-shot, token budget, eval hooks).

### Cách chạy
- User nói: `read docs/milestones.md và chạy M1` (rồi M2…). Một mốc/lần, VERIFY pass mới báo xong. Commit `Mx: <goal>`.

### Quản lý context (Opus 4.8)
- **Mỗi mốc chạy 1 phiên `/clear`.** M6 & M7 nên chia 2 phiên (theo hướng dẫn "Ước lượng token" trong milestones.md).
- Đầu mốc chỉ `read` file mốc liệt kê; khi context >70% → commit, `/clear`, làm nốt.

### Seed & domain
Seed mặc định brand trading "Khang Guru" (XAUUSD). Đổi: `npx prisma db seed -- --domain=dongy`. App domain-agnostic: goal type/pillar/persona là dữ liệu.

## A.2 — Ràng buộc & quy ước

### Ràng buộc KHÓA (khác bản đầu — đọc kỹ)
- **Scope MVP = 8 tab, 22 entity, 30-day only, manual-first.** KHÔNG làm: Inspiration Lab, Experiments, 60/90-day, CSV import, Meta API, Prompt/Framework editor, Company tab riêng, TipTap.
- **Không TipTap / rich text.** FB post là plain text; editor có cấu trúc Hook/Body/Ending; lưu `contentMarkdown`.
- **Review gate:** nút "Duyệt & tạo chiến lược" chỉ bật sau khi user xác nhận Persona + Pillar. Không auto-chain thẳng tới Strategy.
- **Enum chỉ từ `lib/constants.ts`** (OBJECTIVES, HOOK_STYLES, CTA_INTENSITY, FORMATS, POST_STATUS). Validate `z.enum` + normalize. KHÔNG để LLM tự đặt enum.
- **Ratio normalize ở CODE về 100**, không tin LLM.
- **AI chỉ server-side.** Không import key vào client. Dữ liệu ngoài (upload/paste) qua `lib/ai/sanitize.ts` (coi là DỮ LIỆU, không chỉ thị).
- **Không hardcode tên model.** `AIModelConfig` trống → user chọn ở Settings.
- **Strategy 30 ngày sinh THEO TUẦN rồi ghép** (D.4 arc → D.6 mỗi tuần) — tránh truncation.
- **Attribution bắt buộc:** approve draft → tạo `Post` gắn `strategyVersionId` + `dailyPlanId` (Revision Engine cần).
- **`StrategyVersion.reason` non-null.** Mọi đổi hướng lưu lý do.
- **Performance manual tối giản:** 4 field (reach/engagement/comments/saves) + note; tự tính `daysSincePost`; 1 MetricSnapshot/Post.

### Pattern API AI (bắt buộc)
`validateInput → sanitizeExternal → call(temp thấp cho structured) → validateOutput(zod enum) → repairOnce → savePromptRun`.

### Quy ước code
- Prisma singleton `lib/db.ts`. Zod ở `lib/validators/*`. Prompt ở `lib/prompts/<moduleKey>.ts` export `{system, buildUser, outputSchema}`.
- Server state: TanStack Query. UI state: Zustand.
- Empty/Loading/Error mọi trang có dữ liệu; `AiLoading` có tiến độ.
- Không tạo file ngoài mốc hiện tại (chống scope creep).

### Định nghĩa "Done" một mốc
`npm run build` pass, không lỗi type · VERIFY trong milestone pass · acceptance trong feature-spec đạt · seed idempotent, không phá dữ liệu.

### Việc user phải tự làm (ToFill.md)
Nếu một mốc tạo ra hành động THỦ CÔNG của user trước khi vận hành (điền API key/secret, chọn
model/config, chạy smoke-test live cần key) → **append vào `ToFill.md`** (không rải trong
STATE/MEMORY). Không bao giờ ghi giá trị bí mật vào file này.

---

# PHẦN B — PHƯƠNG PHÁP LÀM VIỆC (engine, mọi task)

## 0. Prime directives
- Answer briefly. No restating the prompt, no filler prose (the caveman skill is auto-on).
- Think before coding (see the verbatim Karpathy Guidelines in §4). Make surgical changes only.
- Define a verifiable success criterion before you start; loop until it is met.

## 1. Codebase analysis priority
- Query the graph FIRST: `codegraph` / `codebase-memory-mcp`. They return verbatim
  source grouped by symbol — Read-equivalent and sub-millisecond.
- Fall back to `grep`/`glob` ONLY when the graph cannot answer. Never read
  file-by-file if the graph suffices.

## 2. Token budget
- Target: context window **< 50%**. When exceeded, compress or archive to MEMORY.md.
- 4-layer compression pipeline (ordering + anti-conflict rules live in RULES.md):
  `headroom` (cache+context) -> `rtk` (CLI output) ->
  `token-optimizer` / `codebase-memory` (file-read/graph) -> `caveman` (in-agent prose).

## 3. Continuous work loop (plan.md + todo.md)
- Every task session: read STATE.md, plan.md and todo.md BEFORE acting; pick the
  highest-priority open item.
- Keep plan.md and todo.md updated LIVE as you work: check items off, append
  checkpoints in the form `[HH:MM] step -> verify result`.
- When a goal is fully verified done: delete plan.md and todo.md (or archive the
  decision into MEMORY.md). Never leave them stale.
- Full lifecycle rules: RULES.md > "plan.md & todo.md lifecycle".

## 3a. Scaffold file maintenance (live protocol — keep these current, never stale)
Files live in the project root (`F:\Codex\Personal Brand OS\<file>`).

### Read order (every session start — read BEFORE acting, in this order)
1. **`STATE.md`** — sprint view: where we are, what's next, what's blocked.
2. **`plan.md`** + **`todo.md`** — the active task's live "how" + checklist (skip if empty).
3. **`MEMORY.md`** — lasting decisions/patterns/bug-workarounds so you don't relitigate.
4. **`RULES.md`** — hard rules (project + engine) that gate every change.
5. **`SPEC.md`** — Goal/Scope/Acceptance contract; re-read when scope is in question.
6. **`LOOP.md`** — pick which loop to run (milestone loop vs triage loop).
7. **`AGENTS.md`** — only when delegating/orchestrating sub-agents.
> Then, for project work, read ONLY the current milestone's section per "Đọc trước khi
> làm" above. Stop reading once you have enough to act (Prime directive §0).

### Update triggers — each file has one job; update the right one at the right moment:
- **`LOOP.md`** — whenever a task appears that needs a repeatable, effective *thinking
  journey* (a reusable loop worth naming), define or refine that loop here. Every task
  runs through a loop; when the loop shape changes, LOOP.md changes.
- **`MEMORY.md`** — after **every** task is done: distill the lasting decision/pattern
  here *before* clearing plan.md/todo.md. One entry = one fact.
- **`plan.md`** — when a new plan forms. In **plan mode**, write the plan to `plan.md`
  and reference its path — do NOT paste hundreds of plan lines into CLAUDE.md, STATE.md,
  or the chat. plan.md is the single home for the live "how".
- **`todo.md`** — add the checklist for the active task; tick items as you go.
- **`RULES.md`** — append a project rule the moment a new hard constraint surfaces.
- **`SPEC.md`** — keep the Trellis spec (Goal / Scope / Acceptance) in sync when scope
  changes.
- **`STATE.md`** — sprint-level view; agent-managed. Update at session start/end.
- **`ToFill.md`** — the moment a milestone introduces anything the USER must do by hand
  before go-live (fill an API key/secret, pick a config value, run a live smoke-test that
  needs a key), append it there — one line per item, grouped by category. It is the single
  home for manual pre-launch actions; never scatter them across STATE/MEMORY. Tick items as
  the user reports them done. Secrets themselves never go in the file (RULES.md > Secrets).

## 4. Karpathy Guidelines (VERBATIM — do not summarize)

> Behavioral guidelines to reduce common LLM coding mistakes, derived from Andrej
> Karpathy's observations on LLM coding pitfalls.
> **Tradeoff:** these guidelines bias toward caution over speed. For trivial
> tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" -> "Write tests for invalid inputs, then make them pass"
- "Fix the bug" -> "Write a test that reproduces it, then make it pass"
- "Refactor X" -> "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] -> verify: [check]
2. [Step] -> verify: [check]
3. [Step] -> verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work")
require constant clarification.

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer
rewrites due to overcomplication, and clarifying questions come before
implementation rather than after mistakes.

## 5. Skills
- **Auto:** codebase-memory, token-optimizer, headroom, rtk, caveman, context-monitor, harness, karpathy.
- **Manual:** playwright, context7, evolver, claude-loop batch, docx/pdf/pptx/xlsx, GSD spec.
