# ToFill.md — hành động thủ công của USER trước khi vận hành

> **Vai trò:** file DUY NHẤT gom mọi việc **người dùng phải tự làm tay** (điền API key,
> chọn cấu hình, xác minh live…) — những thứ code KHÔNG thể tự làm và là bước cuối trước
> khi app chạy thật. Mỗi milestone (M1→M10) nếu phát sinh việc kiểu này thì **append vào
> đây**, không rải rác trong STATE/MEMORY. Xong việc nào tick việc đó.
>
> Quy ước dòng: `- [ ] (chưa làm) / [x] (đã làm) — VIỆC · **Ở đâu:** … · **Vì sao:** … · (mốc)`
> Bí mật (key/token) KHÔNG bao giờ commit — xem RULES.md > "Secrets & API keys".

---

## 1. Secrets & môi trường (`.env` — gitignored)

- [ ] **Điền `ANTHROPIC_API_KEY`** · **Ở đâu:** `F:\Codex\Personal Brand OS\.env` (key `ANTHROPIC_API_KEY=""`)
  · **Vì sao:** mọi call AI server-side đọc key này (`lib/ai/anthropic.ts`); rỗng → route AI trả lỗi. (M2/M4)
- [ ] **(Tuỳ chọn) Điền `OPENAI_API_KEY`** · **Ở đâu:** `.env` · **Vì sao:** chỉ cần nếu đổi provider sang OpenAI (`lib/ai/openai.ts`); mặc định dùng Anthropic nên có thể bỏ trống. (M4)
- [x] **`DATABASE_URL`** · **Ở đâu:** `.env` (`file:./dev.db`) · **Vì sao:** SQLite path; đã tạo ở M2. (M2)

## 2. Lựa chọn cấu hình (phải chọn, không hardcode)

- [ ] **Đặt model AI** · **Ở đâu:** `.env` → `AI_DEFAULT_MODEL="…"` (vd `claude-opus-4-8`, hoặc `claude-haiku-4-5` cho rẻ)
  · **Vì sao:** code KHÔNG hardcode tên model (rule #3). `resolveModelConfig()` đọc `AIModelConfig.model || AI_DEFAULT_MODEL`; cả hai rỗng → ném lỗi "Chưa chọn model AI…". Ở M10 sẽ chọn được trong Settings; trước đó dùng env. **Lưu ý:** nếu chọn `opus-4-7/4-8/fable-5` thì adapter tự bỏ `temperature` (API 400) — hành vi đúng, không cần làm gì. (M4)
- [ ] **(Tuỳ chọn) `AI_DEFAULT_PROVIDER`** · **Ở đâu:** `.env` (mặc định `anthropic`) · **Vì sao:** chỉ đổi nếu dùng OpenAI. (M4)
- [ ] **(Tuỳ chọn) Đổi domain seed** · **Ở đâu:** chạy `node node_modules/tsx/dist/cli.mjs prisma/seed.ts --domain=dongy` · **Vì sao:** mặc định brand "Khang Guru" (XAUUSD); chỉ đổi nếu muốn domain khác. Không bắt buộc. (M2)

## 3. Xác minh live còn treo (làm sau khi điền key ở mục 1–2)

- [ ] **Smoke test D.1 (Brand Analyzer)** · **Ở đâu:** `npm run dev` → Onboarding → nút "Phân tích AI"
  · **Vì sao:** M4 chỉ verify bằng mock adapter (không có key lúc build). Sau khi điền key + model: bấm nút phải ra positioning + 3 từ khoá, và có 1 `PromptRun` trong `node node_modules/prisma/build/index.js studio`. (M4)
- [ ] **Smoke test D.2/D.3 (Persona + Pillar)** · **Ở đâu:** `npm run dev` → Khán giả & Trụ cột → "Sinh personas (AI)" + "Sinh trụ cột (AI)"
  · **Vì sao:** M5 chỉ verify bằng mock adapter. Sau khi điền key + model: nút sinh phải ra 2–4 persona / 3–5 pillar (ratio bar tổng =100), lưu được, và có `PromptRun` (moduleKey `audience`/`pillars`) trong Studio. (M5)
- [ ] **Smoke test D.4/D.6 (Strategy 30 ngày)** · **Ở đâu:** `npm run dev` → Chiến lược (sau khi đã duyệt Khán giả & Trụ cột) → "Sinh chiến lược 30 ngày"
  · **Vì sao:** M6 verify bằng mock/unit test (không có key lúc build). Sau khi điền key + model: sinh phải ra 5 weeklyTheme + 30 dailyPlan (call phân tầng: 1× tầng-1 + 5× tuần), lưu `StrategyVersion` v1 (reason non-null), set `AppState.activeStrategyId`, và "Xuất Markdown" tải được file .md đủ field. Kiểm `WeeklyPlan=5`, `DailyPlan=30` trong Studio. (M6)

- [ ] **Smoke test D.8–D.11 (Content Studio: post-writer/hook/cta/tone)** · **Ở đâu:** `npm run dev` → Studio → viết bài từ ContentIdea + nút Hook/CTA/Tone
  · **Vì sao:** M7 verify bằng mock. Sau khi điền key + model: writer ra hook/body/ending + enum hợp lệ; approve → `Post` gắn `strategyVersionId`+`dailyPlanId`; có `PromptRun`. (M7)
- [ ] **Smoke test D.14 (Performance insight)** · **Ở đâu:** `npm run dev` → Hiệu suất → nhập metric ≥1 bài → "Sinh insight"
  · **Vì sao:** M8 verify bằng mock. Sau khi điền key + model: insight có evidence trỏ số thật; <3 bài → confidence=low. (M8)
- [ ] **Smoke test D.15 (Weekly Review / Revision)** · **Ở đâu:** `npm run dev` → Đánh giá tuần → "Sinh đề xuất điều chỉnh" → "Áp dụng — tạo version mới"
  · **Vì sao:** M9 verify bằng mock/unit. Sau khi điền key + model: sinh phải ra adjustmentPlan (mỗi mục có reason) + revisedContentRatio (tổng=100); bấm áp dụng tạo `StrategyVersion` v(n+1) có `reason` non-null, clone WeeklyPlan+DailyPlan (Calendar vẫn đủ), Dashboard hiện card "Điều chỉnh gần nhất". (M9)

## 4. Placeholder cho milestone sau (M5→M10 append vào đây khi phát sinh)

- (M10) Settings sẽ cho chọn model / backup-restore trong UI — khi xong, các mục "đặt model qua env" ở trên có thể chuyển sang chọn trong app.
- (M11 Phase B, sau M10) Đóng gói Electron: installer + bundle Prisma engine + di chuyển SQLite sang OS user-data dir — task build, không phải user-fill; ghi ở đây để không quên.
- _(các mốc sau tự thêm dòng của mình bên trên)_
