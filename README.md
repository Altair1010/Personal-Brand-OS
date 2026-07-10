# Personal Brand Strategy OS (MVP)

Hệ điều hành chiến lược nội dung cho personal brand trên Facebook — chạy **localhost**,
**một người dùng** (không auth, id cố định `local`). Vòng lõi:
*Onboarding → Chiến lược 30 ngày → Viết bài → Đo tay → Weekly Review → Chiến lược v2*.

## 8 tab
Dashboard · Onboarding (Brand DNA + Persona) · Strategy (30 ngày) · Studio (viết bài) ·
Calendar (lịch 30 ngày) · Performance (đo tay) · Weekly Review (Revision Engine) · Settings.

## Stack
Next.js (App Router) · TypeScript · TailwindCSS · shadcn/ui · Prisma · SQLite · Recharts ·
Zustand · TanStack Query · AI adapter (Anthropic/OpenAI). Editor: plain text có cấu trúc
Hook/Body/Ending (không TipTap), lưu `contentMarkdown`.

## Scope MVP (khóa)
8 tab · 22 entity · 30-day only · manual-first · review gate · injection guard.
Phase 2 (KHÔNG làm ở MVP): Inspiration Lab, Experiments, 60/90-day, CSV import, Meta API,
Prompt/Framework editor.

## Chạy local
```bash
npm install
node node_modules/tsx/dist/cli.mjs prisma/seed.ts        # seed mặc định (brand "Khang Guru", XAUUSD)
node node_modules/tsx/dist/cli.mjs prisma/seed.ts -- --domain=dongy   # domain thay thế
npm run dev
```
Seed idempotent — chạy lại không phá dữ liệu. App domain-agnostic: goal type / pillar /
persona đều là dữ liệu.

## Cấu hình AI
Không hardcode tên model. Chọn model trong tab **Settings** (nhà cung cấp = `anthropic` hoặc
`openai`, model = free text), hoặc đặt qua env `AI_DEFAULT_PROVIDER` / `AI_DEFAULT_MODEL`.
Key API chỉ dùng server-side, không import vào client.

## Sao lưu / khôi phục / reset (Settings)
- **Xuất backup** — tải toàn bộ dữ liệu (22 entity) ra 1 file JSON
  `personal-brand-backup-<ngày>.json`.
- **Nhập backup** — chọn file JSON; file được validate trước, file sai sẽ báo lỗi và
  KHÔNG chạm vào dữ liệu.
- **Reset dữ liệu** — hai lớp xác nhận (gõ `RESET` + hộp thoại xác nhận), xóa sạch rồi
  dựng lại seed gốc. Không thể hoàn tác.

## Nguyên tắc cốt lõi
Goal-first · versioning + lưu lý do · không FB API ở MVP · không copy page khác ·
enum từ `lib/constants.ts` · AI chỉ server-side · dữ liệu ngoài coi là DỮ LIỆU (sanitize).
