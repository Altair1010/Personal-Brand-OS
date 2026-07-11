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
- [ ] **(App desktop) Điền key vào `pbos.env`** · **Ở đâu:** `<userData>/pbos.env` (Win: `%APPDATA%\personal-brand-os\pbos.env`; Mac: `~/Library/Application Support/personal-brand-os/pbos.env`), dòng `ANTHROPIC_API_KEY=...` · **Vì sao:** app đóng gói KHÔNG mang repo `.env`; shell Electron đọc file này lúc runtime rồi inject vào server (`electron/runtime.js` `loadUserEnv`). Thiếu file → app vẫn mở nhưng call AI báo "thiếu key". (M11)

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

- [x] **Smoke test M11 (boot production Electron)** — ĐÃ chạy `npm run build:desktop && npm run app:prod`: Electron mở, first-run migrate+seed chạy, server ready HTTP 200, DB tạo ở `AppData\Roaming\Electron\pbos.db` (299KB). (M11)

## 4. Placeholder cho milestone sau (M5→M10 append vào đây khi phát sinh)

- [x] (M10) Settings ĐÃ ship: chọn provider/model trong UI (`/settings` → AiModelConfigForm), backup export/import JSON, reset (2 lớp xác nhận). Mục §2 "đặt model qua env" giờ có thể làm trong app thay vì `.env` (`AIModelConfig.isDefault` được `resolveModelConfig()` ưu tiên).
- [ ] (M10, tuỳ chọn) **Chọn model trong Settings thay cho env** · **Ở đâu:** `npm run dev` → Cài đặt → nhập provider + model + tick "mặc định" · **Vì sao:** thay cho `AI_DEFAULT_MODEL` trong `.env`; row `isDefault=true` được adapter ưu tiên. Không bắt buộc nếu đã đặt env. (M10)
- (M11, sau M10) Desktop runtime cross-platform: boot production trong Electron + dời SQLite sang OS user-data dir + first-run migrate — task build, không phải user-fill.
- (M12, sau M11) Đóng gói: installer `.exe` (Win) + `.dmg` (Mac qua CI) + bundle Prisma engine, unsigned — task build.
- [x] **(M12) Tạo GitHub repo + push remote** · ĐÃ push `master` + tag `v0.1.0` lên `Altair1010/Personal-Brand-OS` → CI `desktop-build.yml` đã kích hoạt. **Vì sao:** artifact Mac (.dmg) chỉ build được trên GitHub Actions `macos-latest` (không cross-build từ Win); workflow `desktop-build.yml` chạy khi push tag `v*`. (M12)
- [ ] **(M12) Cài + mở app từ `.exe`** · **Ở đâu:** `release/Personal Brand OS Setup 0.1.0.exe` (build local) · **Vì sao:** verify GUI: chạy installer → có shortcut Desktop + icon → mở app chạy full UI → DB tạo ở `%APPDATA%\Personal Brand OS\pbos.db`. SmartScreen cảnh báo (unsigned) → "More info → Run anyway". (M12)
- [ ] **(M12) Điền key cho app đã cài** · **Ở đâu:** `%APPDATA%\Personal Brand OS\pbos.env` dòng `ANTHROPIC_API_KEY=...` (lưu ý productName folder = "Personal Brand OS", KHÁC folder "Electron" của bản `app:prod` chưa đóng gói) · **Vì sao:** app đóng gói không mang `.env` repo; thiếu file → call AI báo thiếu key. (M12)
- [ ] **(M12) Tải artifact `.dmg`** · **Ở đâu:** GitHub → Actions → run "Desktop Build" (tag v0.1.0) → job `macos` → artifact `macos-dmg` · **Vì sao:** Mac chỉ build trên CI; Gatekeeper cảnh báo (unsigned) → chuột phải → Open. (M12)
- _(các mốc sau tự thêm dòng của mình bên trên)_

## 5. Extended Milestone 1 (EM1) — key-in-UI · tài khoản+cloud · Facebook

> EM1a **thay** bước "điền `pbos.env`" (mục §1 dòng cuối + §4 M12) bằng nhập trong Settings.
> Sau khi EM1a xong: không cần sửa `pbos.env` tay nữa — vào **Cài đặt → nhập API key + chọn model**.

- [ ] **(EM1a) Nhập API key + chọn model trong Settings** · **Ở đâu:** app → Cài đặt → thêm
  profile (nhà cung cấp Claude/OpenAI, chọn model từ dropdown, dán key, đặt tên, tick mặc định)
  · **Vì sao:** thay `pbos.env`; adapter đọc key từ DB. Key chỉ nằm máy này, KHÔNG lên cloud backup. (EM1a)
- [ ] **(EM1b) Tạo Supabase project free + điền config** · **Ở đâu:** supabase.com → New project (free)
  → Settings → API → lấy `Project URL` + `anon public key` → điền vào `.env` (dev, dòng
  `SUPABASE_URL=...` + `SUPABASE_ANON_KEY=...`) hoặc `pbos.env` (bản đóng gói, cùng thư mục
  userData với `pbos.env` AI key)
  · **Vì sao:** dùng Supabase Auth (đăng nhập) + Storage (lưu backup mã hoá) để khôi phục máy khác.
  anon key là publishable (không phải secret). Free tier đủ dùng cá nhân. Thiếu config → app hiện
  màn "Chưa cấu hình Supabase", không vào được dashboard (hard gate). (EM1b)
- [ ] **(EM1b) Tạo private bucket `backups` + RLS** · **Ở đâu:** Supabase → Storage → New bucket
  tên `backups`, **KHÔNG public** → Policies, thêm policy cho `authenticated` trên cả SELECT/INSERT/
  UPDATE với điều kiện `(storage.foldername(name))[1] = auth.uid()` (mỗi user chỉ đụng thư mục của
  chính mình) · **Vì sao:** snapshot đẩy lên đường dẫn `<userId>/latest.enc`; RLS đảm bảo không ai
  đọc được backup của người khác. App KHÔNG dùng service key (chỉ anon + token user). (EM1b)
- [ ] **(EM1b) Smoke test cloud sync (cần Supabase thật)** · **Ở đâu:** app → Cài đặt → "Sao lưu
  đám mây": đăng ký/đăng nhập → nhập passphrase (≥8 ký tự, GHI NHỚ) → "Sao lưu lên cloud" → kiểm file
  `<userId>/latest.enc` trên Storage → reset DB (Cài đặt → Danger Zone) → "Khôi phục từ cloud" (nhập
  đúng passphrase) → data đầy đủ, phải nhập lại API key · **Vì sao:** EM1b verify hermetic bằng test
  (không có project Supabase lúc build); luồng push/pull thật cần tài khoản + bucket ở 2 mục trên. (EM1b)
- [ ] **(EM1c) Tạo Facebook Developer App + lấy Page Access Token** · **Ở đâu:** developers.facebook.com
  → tạo App → lấy **Page Access Token dài hạn** cho page BẠN là admin → dán vào app (Kết nối Facebook)
  · **Vì sao:** Performance Lab tự kéo metric (dán link post → tự điền). Page của chính bạn nên KHÔNG cần
  app review/business verification. Token chỉ nằm máy này, KHÔNG lên cloud backup. (EM1c)
