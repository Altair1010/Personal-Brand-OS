# Component Guidelines

> Component patterns, props, and composition in Personal Brand OS.

---

## Server vs Client Components

- **Default to server components.** `page.tsx` files are server components — they read
  data (via server actions / Prisma) and render. No `"use client"` unless needed.
- Add `"use client"` **only** when a component uses state, effects, event handlers, a
  Zustand store, or TanStack Query. Push the boundary as low as possible (a server page
  renders a small client island, not the whole tree).
- Examples: `app/(dashboard)/strategy/page.tsx` (server), `components/brand/BrandDnaForm.tsx`
  (client — reads Zustand store).

---

## shadcn Primitives (`components/ui/`)

- Built with **class-variance-authority (cva)** + `cn()` merge. Variants declared in a
  `cva(base, { variants, defaultVariants })` block; props extend the native element +
  `VariantProps<typeof xVariants>`. See `components/ui/button.tsx`.
- Use `forwardRef` + `displayName` for primitives.
- Support polymorphism via Radix `Slot` + `asChild` where composition is needed.
- **Do not fork upstream shadcn structure.** Add variants, don't rewrite.

```tsx
const buttonVariants = cva("inline-flex …", {
  variants: { variant: { default: "…", outline: "…" }, size: { … } },
  defaultVariants: { variant: "default", size: "default" },
});
```

---

## Props

- Type props with a named `interface XProps` (or inline for tiny components).
- Prefer **structured object props** over many positional args. For actions, pass a
  `{ label, onClick }` object (see `EmptyState` `action` prop) rather than two props.
- Optional props use `?`; render conditionally (`{Icon && …}`, `{description && …}`).

---

## Required States (project rule)

Every page that renders data MUST handle **Empty / Loading / Error**. Use the shared
components — do not hand-roll:

- `components/EmptyState.tsx` — icon + title + description + optional action button.
- `components/ErrorState.tsx` — for failed loads.
- `components/AiLoading.tsx` — loading with progress, used for AI calls specifically.

A page with no data yet still renders a real `EmptyState` (see `strategy/page.tsx`), not
a blank screen or a spinner-forever.

---

## Composition

- Layout is centralized: `AppShell` (Sidebar + Topbar) wraps `(dashboard)` routes;
  pages render `PageHeader` + content inside `PageContainer`.
- Drive repeated form fields from a **config array** mapped to JSX, not copy-paste. See
  `CORE_FIELDS` / `COMPANY_FIELDS` in `BrandDnaForm.tsx`.

---

## Styling

- Tailwind utility classes only. Merge conditional classes with `cn()` (`@/lib/utils`) —
  never string-concatenate class names.
- Use the semantic design tokens (`bg-muted`, `text-muted-foreground`, `text-foreground`,
  `border-input`, …), not raw palette colors, so theming stays consistent.

---

## Forbidden

- **No TipTap / rich-text editors.** FB post content is plain text with a structured
  Hook/Body/Ending editor; stored as `contentMarkdown` (project hard rule).
- No inline enum string literals — import from `lib/constants.ts`.
- No data fetching with `fetch` in a `useEffect` when a server action or TanStack Query
  fits (see hook guidelines).
