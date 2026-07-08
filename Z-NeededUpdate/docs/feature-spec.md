# G. Feature Specification — MVP LOCKED (8 module)

Format: **User story · Functional · Data · AI · UI · Acceptance · Edge.**
Phase 2 (không spec ở đây): Inspiration Lab, Experiments, Prompt/Framework editor, Company tab riêng.

## 1. Dashboard
- **Story:** thấy "đang ở đâu, cần làm gì tuần này".
- **Functional:** đọc `AppState` (active Goal/Strategy); đếm Post theo status; top posts; insight mới nhất; đề xuất tuần; cảnh báo rule-based (lệch định vị / quá bán hàng / thiếu educate-proof-story).
- **Data:** AppState, Goal, StrategyVersion, Post, MetricSnapshot, PerformanceInsight.
- **AI:** không (đọc insight có sẵn).
- **UI:** GoalSummaryCard, PillarStatusCard, PostCountCards, TopPostsTable, LatestInsightCard, WeeklyAdjustmentCard, WarningPanel.
- **Acceptance:** [ ] có strategy → cards có số [ ] trống → empty state có CTA "Bắt đầu onboarding" [ ] warnings chạy.
- **Edge:** chưa có strategy; nhiều goal → dùng AppState.activeGoalId.

## 2. Onboarding (Brand DNA + Company gộp → Goal)
- **Story:** khai báo tôi là ai + mục tiêu, 1 mạch, ra được chiến lược sớm.
- **Functional:** wizard tuyến tính. Bước 1 Brand DNA (11 trường lõi + companyName/offers/usp/region); upload docx/pdf → trích text (ảnh = paste text); nút "Phân tích AI" → positioning + 3 từ. Bước 2 Goal (KPI, content ratio, goal type). Kết thúc: set `AppState.activeGoalId`.
- **Data:** BrandDNA (đã gộp company), Goal, AppState.
- **AI:** D.1 Brand DNA Analyzer.
- **UI:** BrandDnaForm, FileDropzone, AiSuggestionPanel, ThreeWordPicker, GoalForm, KpiEditor, ContentRatioSlider.
- **Acceptance:** [ ] đi hết wizard lưu Brand+Goal [ ] reload giữ dữ liệu [ ] upload docx trả text [ ] AI fail không mất input [ ] set active goal.
- **Edge:** file hỏng → nhập tay; KPI không đo được → cảnh báo.

## 3. Audience & Pillars (1 màn + review gate)
- **Story:** hiểu khách + trụ cột, AI làm hộ, tôi chỉ chỉnh, rồi duyệt.
- **Functional:** "Generate personas" (2–4) + "Generate pillars" (3–5, ratio). Edit tay. **Normalize ratio=100 ở code.** Nút "Duyệt & tạo chiến lược" (review gate) chỉ bật sau khi user xác nhận.
- **Data:** AudienceSegment, ContentPillar.
- **AI:** D.2 Persona, D.3 Pillar (ép dùng id/tên canonical).
- **UI:** PersonaCard, PersonaEditor, PillarBoard, RatioBar, ApproveGate.
- **Acceptance:** [ ] persona 2–4 [ ] pillar ratio tổng 100 [ ] edit lưu [ ] gate chặn khi chưa duyệt.
- **Edge:** goal thiếu audience → suy luận + assumption; ratio lệch → auto-normalize.

## 4. Strategy Builder (30 ngày)
- **Story:** biến mục tiêu thành kế hoạch 30 ngày.
- **Functional:** chọn framework (optional); Generate (**sinh theo tuần rồi ghép**); versioning; export Markdown; set `AppState.activeStrategyId`.
- **Data:** Strategy, StrategyVersion (reason bắt buộc), WeeklyPlan, DailyPlan, ContentIdea, ExportHistory.
- **AI:** D.4 (30-day arc + weekly themes), D.6 (weekly→daily), D.7 (idea).
- **UI:** StrategyWizard, FrameworkPicker, StrategyPreview, WeeklyThemeTimeline, ExportMarkdownButton.
- **Acceptance:** [ ] weekly themes = 5 [ ] daily plan = 30 [ ] version1 lưu reason+assumptions [ ] export md.
- **Edge:** output lớn → call phân tầng; thiếu pillar/gate chưa duyệt → chặn.

## 5. Content Studio + Calendar
- **Story:** viết bài đúng objective, giọng brand (plain text FB).
- **Functional:** chọn objective/framework/tone/length/CTA; AI viết hook/body/ending; regenerate theo tone; hook/CTA variants; status idea→draft→approved→posted→analyzed; **lưu analytic dims** (hookStyle/ctaIntensity/format/topic); approve → tạo Post gắn **attribution** (strategyVersionId + dailyPlanId); Calendar view.
- **Data:** ContentDraft (versioned + analytic dims), Post (attribution + mirror dims), ContentTemplate (seed).
- **AI:** D.8 Writer, D.9 Hook, D.10 CTA, D.11 Tone.
- **UI:** StructuredEditor (Hook/Body/Ending textarea), ObjectiveSelect, FrameworkSelect, HookGeneratorPanel, CtaGeneratorPanel, ToneRewriter, StatusStepper, CalendarMonth, DayCell, PostChip.
- **Acceptance:** [ ] viết bài đầy đủ [ ] đổi tone giữ ý [ ] approve → Post có attribution [ ] analytic dims lưu [ ] draft version tăng [ ] calendar theo dailyPlan.
- **Edge:** conversion thiếu offer → dùng mainOffer + assumption.

## 6. Performance Lab (manual tối giản)
- **Story:** đo hiệu quả nhanh, biết cái gì hoạt động.
- **Functional:** bảng inline nhập 4 field bắt buộc (reach, engagement, comments, saves) + inbox/conversion note optional; tự tính `daysSincePost`; dashboard theo pillar/hook/cta/format; AI insight có evidence + confidence.
- **Data:** MetricSnapshot (1/Post), PerformanceInsight.
- **AI:** D.14 (evidence thật; <3 bài → confidence=low).
- **UI:** MetricInlineTable (label định nghĩa metric FB cạnh field), PerformanceCharts, PillarPerfTable, HookPerfTable.
- **Acceptance:** [ ] nhập nhanh inline [ ] daysSincePost đúng [ ] charts render [ ] insight có evidence+confidence.
- **Edge:** <3 bài → low-confidence, không over-claim.

## 7. Weekly Review / Revision Engine (nhẹ)
- **Story:** cuối tuần app tự đề xuất điều chỉnh, giữ lịch sử "vì sao đổi hướng".
- **Functional:** rule-based (pillar yếu, quá bán hàng) + 1 call AI; tạo StrategyVersion mới có `reasonForNewVersion` bắt buộc; dùng **attribution** Post→StrategyVersion để so sánh.
- **Data:** PerformanceInsight, StrategyVersion.
- **AI:** D.15.
- **UI:** WeeklyAdjustmentCard, RevisionDiff.
- **Acceptance:** [ ] tạo version mới [ ] reason bắt buộc [ ] adjustment có lý do.
- **Edge:** thiếu data → "giữ nguyên + thu thêm", vẫn ghi version note.

## 8. Settings
- **Story:** cấu hình AI, backup, reset.
- **Functional:** chọn provider/model (AIModelConfig, **không seed sẵn**); export/import backup JSON; reset DB (danger zone, xác nhận).
- **Data:** AIModelConfig, ExportHistory.
- **UI:** AiModelConfigForm, BackupPanel, DangerZone.
- **Acceptance:** [ ] đổi model áp dụng [ ] backup round-trip [ ] reset có xác nhận.
- **Edge:** import sai định dạng → báo lỗi, không phá dữ liệu.
