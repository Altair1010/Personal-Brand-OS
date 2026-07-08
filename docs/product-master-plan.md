# Personal Brand Strategy OS — Product Master Plan (MVP LOCKED)

> Source of truth. KHÔNG code trước khi đọc file này + `milestones.md`.
> Mô tả tiếng Việt; định danh kỹ thuật tiếng Anh.

---

## 0. Assumptions & Constraints

### Assumptions (đã chốt)
1. **Single-user, localhost.** Không auth/multi-tenant ở MVP. `UserProfile.id = "local"`. Có `AppState` singleton giữ `activeGoalId/activeStrategyId`.
2. **Domain-agnostic.** Goal type / pillar / persona là **dữ liệu**, không hard-code UI. Yêu cầu gốc trộn Đông y & Trading vàng → seed cấu hình được.
3. **Seed mẫu = brand trading "Khang Guru" (XAUUSD)**; `--domain=dongy` để đổi.
4. **AI = Anthropic mặc định**, OpenAI adapter thứ 2. **Không hardcode tên model** — chọn ở Settings (`AIModelConfig`).
5. **KHÔNG Facebook/Meta API ở MVP.** Performance = manual (CSV/API là phase 2).
6. **Không copy nội dung** bên thứ ba (Inspiration là phase 2, có injection guard sẵn).
7. **Versioning bắt buộc.** `StrategyVersion.reason` non-null; `ContentDraft.version`.
8. **KHÔNG TipTap.** FB post là plain text; editor có cấu trúc hook/body/ending (`contentMarkdown`).

### Constraints
- Stack: Next.js App Router + TypeScript + Tailwind + shadcn/ui + Prisma + SQLite + Recharts + Zustand + TanStack Query. (Editor: plain structured, **không** rich text.)
- Node ≥ 20, Next ≥ 15.
- AI **server-side only**; key trong `.env` (gitignored). Dữ liệu ngoài (file/paste) phải qua `sanitize` (coi là DỮ LIỆU, không phải chỉ thị).
- Enum lấy từ `lib/constants.ts` (nguồn duy nhất) + validate zod.

### Success metrics
- Trống → chiến lược 30 ngày đầy đủ trong **< 15 phút** (qua onboarding wizard 1 mạch).
- Viết 1 bài FB theo objective trong **< 3 phút**.
- Sau 1 tuần nhập metric → Weekly Review sinh insight + adjustment không cần chỉnh tay.
- Backup/restore JSON round-trip không mất dữ liệu.

---

## A. PRODUCT MASTER PLAN

### A.1. Vision
Một **hệ điều hành chiến lược nội dung cá nhân**: *mục tiêu → định vị → chiến lược → nội dung → đo lường → điều chỉnh*, có trí nhớ (biết "vì sao tháng này đi hướng này") và học được từ framework khác. Không phải tool viết bài lẻ.

Nguyên tắc: Goal-first (không idea-first) · Strategy có trí nhớ (versioned + lưu lý do) · Feedback loop khép kín · AI là cộng sự **có review gate** và validation.

### A.2. Core user journey (đã tối giản)
```
Onboarding wizard (1 mạch): Brand DNA (+company) → Goal
  → Audience & Pillars (AI auto đề xuất, user chỉ chỉnh) → [REVIEW GATE: user duyệt]
  → Strategy 30 ngày (AI, sinh theo tuần rồi ghép) → StrategyVersion v1
  → Content Studio (viết bài plain text theo objective) → approve → Post (gắn attribution)
  → đăng tay lên FB → Performance (nhập tay tối giản 4 field)
  → Weekly Review → StrategyVersion v2 (có lý do) → lặp
```
Time-to-value: output chiến lược đầu tiên ngay sau onboarding, không bắt qua 5 màn rời rạc.

### A.3. Main use cases
UC-1 tạo chiến lược 30 ngày từ mục tiêu · UC-2 viết bài theo objective · UC-3 nhập & phân tích performance thủ công · UC-4 điều chỉnh chiến lược giữ lịch sử phiên bản · UC-5 export Markdown + backup/restore.

### A.4. MVP scope (LÀM)
- Onboarding wizard: Brand DNA (đã gộp company) + upload docx/pdf + Goal.
- Audience & Pillars: AI generate + edit + **review gate** + normalize ratio=100.
- Strategy Builder **30 ngày** (theo tuần → ghép), versioning, export Markdown.
- Content Studio (plain text hook/body/ending) + AI writer/hook/cta/tone + status workflow + **attribution** + Calendar.
- Performance Lab **manual tối giản** (reach/engagement/comments/saves + note) + charts + AI insight có evidence/confidence.
- Weekly Review / Revision Engine (nhẹ: rule-based + 1 call AI, tạo version có lý do).
- Settings: AI model config, backup/restore/reset.

### A.5. Non-MVP (PHASE 2 — không làm)
Inspiration Lab · Experiments · Strategy 60/90 ngày · CSV import · Meta/FB API · auto-publish · Prompt/Framework editor (MVP read-only seed) · Company tab riêng · time-series metric (nhiều snapshot/bài) · sentiment · image generation · multi-user/auth/cloud · PDF export đẹp · multi-platform · TipTap/rich text.

### A.6. Feature map
| Nhóm | Module | MVP? |
|---|---|---|
| Foundation | Dashboard | ✅ |
| Onboarding | Brand DNA (+company), Goal | ✅ |
| Direction | Audience & Pillars (1 màn) | ✅ (review gate) |
| Planning | Strategy Builder (30d) | ✅ |
| Production | Content Studio + Calendar | ✅ (plain text) |
| Measurement | Performance Lab | ✅ (manual) |
| Optimization | Weekly Review / Revision | ✅ (nhẹ) |
| System | Settings + Backup | ✅ |
| — | Inspiration, Experiments, Prompt/Framework editor, 60/90d, CSV | ⛔ phase 2 |

### A.7. AI workflow map
```
BrandDNA ─►[D.1 Analyzer]─► positioning/3-words
BrandDNA+Goal ─►[D.2 Persona]─► personas[]  ┐
BrandDNA+Goal+Persona ─►[D.3 Pillar]─► pillars[]+ratio ┘─►[REVIEW GATE]
approved ─►[D.4 Strategy 30d arc]─►[D.6 Weekly→Daily]─►[D.7 Idea]─► plan
Idea ─►[D.8 Post Writer]+[D.9 Hook][D.10 CTA][D.11 Tone]─► draft ─► Post
Post+Metrics ─►[D.14 Perf Analyzer]─► insights[] (evidence, confidence)
insights+strategy ─►[D.15 Revision]─► StrategyVersion+ (reason bắt buộc)
```
Mọi call: `validateInput → sanitize → call(temp thấp) → validateOutput(zod enum) → repairOnce → savePromptRun`.

### A.8. Data flow
UI/upload → server action/route → sanitize (dữ liệu ngoài) → zod validate → [AI adapter + validate output] → Prisma (SQLite) → TanStack Query invalidate → UI. Export: Prisma read → serializer md/json → download + ExportHistory.

### A.9–A.10. Risks / metrics
Xem "Top 10 Risks" cuối file và §0.

---

## B. INFORMATION ARCHITECTURE (8 tab — progressive disclosure)

```
Dashboard
Onboarding        (Brand DNA + Company gộp → Goal; wizard tuyến tính)
Audience & Pillars (1 màn, AI auto + edit + review gate)
Strategy          (30-day builder + versions + export)
Studio + Calendar (viết bài plain text + lịch)
Performance       (manual metric + charts + insight)
Weekly Review     (revision engine)
Settings          (AI model, backup/restore/reset)
```
Tab nâng cao (Inspiration/Experiments/Prompt/Framework) **ẩn** cho tới phase 2. Ngôn ngữ đời thường thay jargon ở nhãn UI (vd "Tỉ lệ nội dung" thay "content ratio").

Đặc tả từng tab: xem `feature-spec.md`.

---

## E. FOLDER STRUCTURE (CUỐI)
```
personal-brand-os/
├── app/
│   ├── (dashboard)/
│   │   ├── page.tsx                 # Dashboard
│   │   ├── onboarding/page.tsx      # Brand(+company) → Goal wizard
│   │   ├── audience-pillars/page.tsx
│   │   ├── strategy/page.tsx
│   │   ├── studio/page.tsx
│   │   ├── studio/[draftId]/page.tsx
│   │   ├── calendar/page.tsx
│   │   ├── performance/page.tsx
│   │   ├── review/page.tsx
│   │   └── settings/page.tsx
│   ├── api/
│   │   ├── ai/{brand-dna,audience,pillars,strategy,weekly-plan,post-writer,hook,cta,tone,performance,revision}/route.ts
│   │   ├── upload/route.ts
│   │   ├── export/route.ts
│   │   └── backup/route.ts
│   ├── layout.tsx
│   └── globals.css
├── components/{layout,brand,strategy,content,performance,forms,ui}/
├── lib/
│   ├── ai/{adapter,anthropic,openai,run,json,sanitize}.ts
│   ├── prompts/*.ts
│   ├── strategy-engine/  ├── content-engine/  ├── performance-engine/
│   ├── validators/*.ts
│   ├── constants.ts                 # OBJECTIVES, HOOK_STYLES, CTA_INTENSITY, FORMATS, POST_STATUS
│   ├── import-export/{markdown.ts, backup.ts}
│   ├── db.ts  └── utils/
├── prisma/{schema.prisma, seed.ts}
├── data/seed/khang-guru.json
├── docs/*.md
├── CLAUDE.md · README.md · .env.example
```
KHÔNG có ở MVP: `inspiration-lab/`, `experiments/`, `prompt-library/`, `framework-library/`, `company/`, `import-export/csv.ts`.

---

## F. UI/UX DESIGN SYSTEM
Admin dashboard hiện đại, "chiều sâu chiến lược", đáng tin, dễ dùng cho người không kỹ thuật. Progressive disclosure: chỉ hiện cái cần.

- **Layout:** sidebar 8 mục (collapsible) + topbar (breadcrumb, model AI, quick action) + content max-width, nhiều khoảng trắng.
- **Card / Form / Table:** shadcn; form dùng react-hook-form + zod, inline error, autosave ở Studio.
- **Calendar:** grid tháng/tuần, PostChip màu theo objective, kéo-thả.
- **Editor:** textarea có cấu trúc (Hook / Body / Ending) + panel Objective/Framework/Tone/CTA + nút AI. KHÔNG rich text.
- **Metric dashboard:** Recharts (line reach, bar pillar/format, so hook/cta). Empty = hướng dẫn.
- **States:** Empty (icon+CTA) · Loading (`AiLoading` có tiến độ cho AI) · Error (banner mềm + retry, không mất input).
- **Color:** slate/zinc + accent indigo `#4f46e5`; semantic success/warning/danger/info; objective tags (SEO=cyan, Educate=blue, Trust=violet, Conversion=amber, Story=rose, Community=emerald).
- **Type:** Inter (UI), JetBrains Mono (code). Scale 2xl/xl/base/sm.
- **Hierarchy:** `AppShell → Sidebar + Topbar + PageContainer(PageHeader+content)`; tái dùng `Card, DataTable, AiPanel, StatusBadge, EmptyState, ErrorState, AiLoading`.

---

## TOP 10 RISKS (đã cập nhật theo review)
1. **Mệt mỏi nhập metric tay = vòng lặp chết** (rủi ro #1 sản phẩm) → tối giản 4 field, bảng inline, không bắt buộc inbox/conversion.
2. **AI trả JSON/enum sai schema** → zod enum từ constants + normalize ratio ở code + repair.
3. **Lỗi cộng dồn Brand→Persona→Pillar→Strategy** → **review gate** bắt buộc trước Strategy.
4. **Truncation output 30 ngày** → sinh theo tuần rồi ghép (không 1 JSON khổng lồ).
5. **Prompt injection từ file/paste** → `sanitize` bọc dữ liệu ngoài.
6. **Non-determinism / bịa số / drift tiếng Anh** → temperature thấp + validate + hardening prompt.
7. **Model string hardcode lỗi thời** → không seed tên model; chọn ở Settings.
8. **App quá phức tạp cho người không kỹ thuật** → 8 tab + wizard + progressive disclosure + ngôn ngữ đời thường.
9. **Mất dữ liệu local / migration phá seed** → backup/restore JSON + seed idempotent.
10. **Over-promise attribution (inbox/conversion về từng bài)** → để dạng note, không dựng chart.
