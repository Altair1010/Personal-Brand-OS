# Directory Structure

> How backend / server code is organized in Personal Brand OS.

---

## Overview

No separate backend service. "Backend" = the **server side of Next.js**: server actions,
route handlers, Prisma data access, and server-only libs. Single-user local desktop app
(Electron shell) over SQLite.

Server code lives in three places:

- **Server actions** — `app/**/actions.ts` with `"use server"`, co-located with the
  feature route that uses them (e.g. `app/(dashboard)/onboarding/actions.ts`).
- **Route handlers** — `app/api/**/route.ts` for non-action HTTP endpoints
  (e.g. file upload: `app/api/upload/route.ts`).
- **Server-only libs** — `lib/` modules imported by the above: `lib/db.ts` (Prisma
  singleton), `lib/validators/*`, `lib/constants.ts`, and (from M4) `lib/ai/*`,
  `lib/prompts/*`.

---

## Directory Layout

```
app/
├── (dashboard)/<feature>/actions.ts   # "use server" — mutations + reads for a feature
└── api/<name>/route.ts                # route handlers (export runtime = "nodejs")

lib/
├── db.ts                              # Prisma singleton (server-only)
├── constants.ts                       # enum sources of truth
├── validators/                        # zod schemas (input + AI output)
├── ai/                                # (M4+) sanitize, adapter, savePromptRun
└── prompts/                           # (M4+) <moduleKey>.ts = {system, buildUser, outputSchema}

prisma/
├── schema.prisma                      # 22 MVP entities
└── seed.ts                            # idempotent seed (Khang Guru / XAUUSD default)
```

---

## Module Organization

- **Data access goes through `lib/db.ts`** — import `db` (or `prisma`). Never instantiate
  `new PrismaClient()` elsewhere.
- **One AI module = one file** `lib/prompts/<moduleKey>.ts` exporting
  `{ system, buildUser, outputSchema }` (Prompt System v2).
- Keep business logic in the server action / lib module, not in the React page.
- Route handlers declare `export const runtime = "nodejs"` when they use Node APIs
  (Buffer, file parsing) — see `app/api/upload/route.ts`.

---

## Naming Conventions

- Server-action files: `actions.ts`. Route handlers: `route.ts` (Next.js convention).
- Lib modules: `camelCase.ts`. AI prompt modules keyed by `moduleKey`
  (`brand-dna`, `pillars`, `strategy`, …).
- Fixed singleton ids match the seed: `USER_ID = "local"`, `APPSTATE_ID = "singleton"`,
  `UserProfile.id = "local"`.

---

## Examples

- Server action feature: `app/(dashboard)/onboarding/actions.ts`
  (`safeParse` → upsert/update → `revalidatePath` → typed result).
- Route handler: `app/api/upload/route.ts` (validate file → parse → JSON response).
