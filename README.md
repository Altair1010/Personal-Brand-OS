# Personal Brand Strategy OS (MVP)

Hệ điều hành chiến lược nội dung cho personal brand trên Facebook — chạy **localhost**.
Vòng lõi: *Onboarding → Chiến lược 30 ngày → Viết bài → Đo tay → Weekly Review → Chiến lược v2*.

## Stack
Next.js (App Router) · TypeScript · TailwindCSS · shadcn/ui · Prisma · SQLite · Recharts · Zustand · TanStack Query · AI adapter (Anthropic/OpenAI). Editor: plain text có cấu trúc (không TipTap).

## Scope MVP (khóa)
8 tab · 22 entity · 30-day only · manual-first · review gate · injection guard.
Phase 2: Inspiration Lab, Experiments, 60/90-day, CSV import, Meta API, Prompt/Framework editor.

## Bắt đầu
1. Đọc `docs/milestones.md` (file thực thi: local dev + prompt system v2 + M0–M10), `docs/product-master-plan.md`, `docs/database-schema.md`.
2. Claude Code: `read docs/milestones.md` → chạy `M1`, `M2`, … `M10`.
3. Cài local: xem PHẦN 1 trong `docs/milestones.md`.

## Nguyên tắc cốt lõi
Goal-first · versioning + lưu lý do · không FB API ở MVP · không copy page khác · enum từ `lib/constants.ts`.
