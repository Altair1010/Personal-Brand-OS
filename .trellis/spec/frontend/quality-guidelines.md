# Quality Guidelines

> Frontend code quality standards for Personal Brand OS.

---

## Required Patterns

- **Empty / Loading / Error** on every data page — use shared `EmptyState` /
  `ErrorState` / `AiLoading`. `AiLoading` must show progress.
- **Enums from `lib/constants.ts` only** (OBJECTIVES, HOOK_STYLES, CTA_INTENSITY, FORMATS,
  POST_STATUS). Validate with `z.enum` from those consts. Never inline enum strings.
- **`cn()`** for conditional class merging (`@/lib/utils`).
- **Server component by default**; `"use client"` only where interactivity requires it.
- **Narrow Zustand selectors** (one value per selector).

---

## Forbidden Patterns

- **TipTap / rich text.** Post editor is structured plain text (Hook/Body/Ending),
  stored as `contentMarkdown`.
- **AI on the client.** No API key in client code; all AI calls are server-side. External
  text (upload/paste) is treated as DATA and sanitized server-side before any AI call.
- **Hardcoded model names.** Model comes from `AIModelConfig` / Settings.
- **`any`** and unchecked type assertions (see type-safety.md).
- **Server data in Zustand / `useState`** — use TanStack Query.
- **Files outside the current milestone** (scope creep). Build MVP scope only:
  8 tabs · 22 entities · 30-day · manual-first.

---

## Lint / Build Gate

- `npm run lint` (`eslint-config-next`) clean.
- `npm run build` passes with **no type errors** — this is part of the milestone Done gate.

---

## Testing

MVP is manual-first with a small footprint; there is no broad frontend test suite. When a
milestone requires it (e.g. AI modules), add targeted tests as specified by that milestone
rather than blanket coverage. Do not add speculative tests.

---

## Code Review Checklist

- [ ] Correct server/client boundary; `"use client"` only where needed.
- [ ] Empty / Loading / Error states present.
- [ ] Enums imported from `lib/constants.ts`, validated by `z.enum`.
- [ ] No client-side AI key; external data sanitized server-side.
- [ ] TanStack Query for server state; Zustand only for transient UI.
- [ ] Narrow store selectors; immutable patches.
- [ ] No new files outside the current milestone's scope.
