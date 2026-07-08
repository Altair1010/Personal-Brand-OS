# C. Data Schema & Database Design — MVP LOCKED

DB: **SQLite** · ORM: **Prisma**. Quy ước: `id String @id @default(cuid())`, `createdAt/updatedAt` mọi bảng. SQLite không có enum → **String + validate zod**, và mọi giá trị enum lấy từ **`lib/constants.ts`** (nguồn duy nhất) để tránh drift ("educate" vs "education").

## Thay đổi so với bản đầu (theo review Principal Engineer)
- **BỎ:** `Campaign` (tầng chết), `PainPoint` (gộp vào persona).
- **GỘP:** `CompanyProfile` → `BrandDNA` (`companyName, offers, usp, region`).
- **THÊM analytic dims** vào `ContentDraft` + mirror lên `Post`: `hookStyle, ctaIntensity, format, topic` → Performance/Revision mới group-by được.
- **THÊM attribution** vào `Post`: `strategyVersionId, dailyPlanId` → Revision Engine truy vết được bài thuộc phiên bản/tuần nào.
- **BỎ TipTap:** bỏ `contentJson`; giữ `contentMarkdown` (plain text FB).
- **`MetricSnapshot`:** thêm `daysSincePost`; MVP **1 bản/Post** (`@@unique([postId])`); bỏ `sentiment`; `inbox`→`inboxNote` (free text, không dựng chart).
- **THÊM `AppState`** (singleton): `activeGoalId, activeStrategyId`.
- **`StrategyVersion.reason`** thành **bắt buộc** (non-null).
- **Phase 2 (KHÔNG có ở MVP):** `CaseStudy`, `ReferencePage`, `Experiment`.

## Danh sách entity MVP (22)
AppState · UserProfile · BrandDNA(+company) · Goal · AudienceSegment · ContentPillar · ContentObjective · ContentTemplate · Framework · Strategy · StrategyVersion · WeeklyPlan · DailyPlan · ContentIdea · ContentDraft · Post · MetricSnapshot · PerformanceInsight · PromptTemplate · PromptRun · AIModelConfig · ExportHistory.
> (ContentTemplate & Framework: seed cứng, read-only ở MVP — không có editor CRUD.)

## Enum chuẩn hóa (lib/constants.ts — không tin LLM)
- `OBJECTIVES = ["seo","educate","trust","conversion","story","community"]`
- `HOOK_STYLES = ["question","contrarian","story","curiosity","pain"]`
- `CTA_INTENSITY = ["soft","medium","hard"]`
- `FORMATS = ["text","image","carousel","video","reel"]`
- `POST_STATUS = ["idea","draft","approved","posted","analyzed"]`
Mọi output AL dùng enum này validate bằng `z.enum(...)` + `.transform(lowercase/trim)`.

## Quan hệ chính (đã sửa)
- BrandDNA 1-1 UserProfile (đã chứa company).
- Goal n-1 UserProfile; Strategy n-1 Goal; Strategy 1-n StrategyVersion.
- StrategyVersion 1-n WeeklyPlan → 1-n DailyPlan → 1-n ContentIdea → 1-n ContentDraft → 1-1 Post.
- **Post → StrategyVersion (attribution)** và **Post → DailyPlan** (mới, quan trọng).
- Post 1-1 MetricSnapshot (MVP). MetricSnapshot → aggregate → PerformanceInsight → input → StrategyVersion mới.
- AppState singleton giữ activeGoalId/activeStrategyId (Dashboard & mọi module đọc "cái đang chạy").

## Điểm cần enforce ở code (không dựa vào LLM)
1. `ContentPillar.ratioPercent` tổng = 100 → **normalize ở code** sau khi AI trả.
2. `objectiveKey/hookStyle/ctaIntensity/format` phải thuộc constants → zod enum.
3. `StrategyVersion.reason` không rỗng.
4. `MetricSnapshot.daysSincePost` tự tính từ `publishedAt` và `capturedAt`.
5. Persona/pillar tham chiếu bằng **id canonical**, không bằng tên tự do.

## Bản Prisma schema
Xem `prisma/schema.prisma` (đã cập nhật, 22 entity MVP).
