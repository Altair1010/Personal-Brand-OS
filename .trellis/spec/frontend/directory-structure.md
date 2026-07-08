# Directory Structure

> How frontend code is organized in Personal Brand OS.

---

## Overview

Next.js 15 **App Router** + React 19. No `src/` — top-level `app/`, `components/`,
`lib/`. UI is a local desktop app (Electron shell), single-user, offline-first.

- **Routes / pages** → `app/`. Dashboard routes live under the `(dashboard)` route
  group so they share `AppShell` without adding a URL segment.
- **Components** → `components/`, split by role (see layout below).
- **Client-side logic** (stores, validators, utils, constants) → `lib/`.

---

## Directory Layout

```
app/
├── layout.tsx                     # root layout: fonts, <Providers>, global CSS
├── (dashboard)/                   # route group — shared AppShell, no URL segment
│   ├── page.tsx                   # dashboard home
│   ├── onboarding/
│   │   ├── page.tsx               # server component (reads data, passes to client)
│   │   └── actions.ts             # "use server" — server actions for this feature
│   ├── audience-pillars/page.tsx
│   ├── strategy/page.tsx
│   ├── studio/page.tsx
│   ├── studio/[draftId]/page.tsx  # dynamic route
│   ├── calendar/page.tsx
│   ├── performance/page.tsx
│   ├── review/page.tsx
│   └── settings/page.tsx
└── api/
    └── upload/route.ts            # route handler (server-only)

components/
├── ui/                            # shadcn primitives (button, card, input, …) — cva-based
├── layout/                        # AppShell, Sidebar, Topbar, PageHeader, PageContainer
├── forms/                         # reusable form controls (GoalForm, KpiEditor, …)
├── brand/                         # onboarding-feature components
├── EmptyState.tsx                 # shared state components (Empty / Error / AiLoading)
├── ErrorState.tsx
├── AiLoading.tsx
└── Providers.tsx                  # TanStack Query provider (client)

lib/
├── db.ts                          # Prisma singleton (server-only)
├── constants.ts                   # THE ONLY place enum values are declared
├── utils.ts                       # cn() helper
├── validators/                    # zod schemas + inferred types (goal.ts, brandDna.ts)
└── stores/                        # Zustand UI stores (onboarding.ts)
```

---

## Module Organization

A **feature** is organized around its route folder:

- The `page.tsx` is a **server component** by default — it reads data and renders.
- Co-locate the feature's **server actions** as `actions.ts` (`"use server"`) in the
  same route folder (see `app/(dashboard)/onboarding/actions.ts`).
- Feature-specific components go in a named folder under `components/` (e.g.
  `components/brand/` for onboarding). Only promote to `components/ui` or
  `components/forms` when reused across features.

---

## Naming Conventions

- **Components**: `PascalCase.tsx` (`BrandDnaForm.tsx`, `EmptyState.tsx`).
- **shadcn primitives** in `components/ui/`: `kebab-case.tsx` (`button.tsx`) — keep the
  upstream shadcn naming, do not rename.
- **lib modules**: `camelCase.ts` (`brandDna.ts`, `onboarding.ts`).
- **Route folders**: `kebab-case` (`audience-pillars`). Dynamic segments `[param]`.
- Import alias `@/` maps to project root (`@/lib/db`, `@/components/ui/button`).

---

## Examples

- Well-structured feature: `app/(dashboard)/onboarding/` — server `page.tsx` +
  co-located `actions.ts` + `components/brand/*` + `lib/stores/onboarding.ts`.
- Simple placeholder page (Empty state only): `app/(dashboard)/strategy/page.tsx`.
