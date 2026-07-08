# Type Safety

> Type patterns in Personal Brand OS.

---

## Foundation

- **TypeScript strict**, React 19 types. Import alias `@/` = project root.
- Runtime validation = **zod v4**. The pattern is **schema-first**: declare the zod
  schema, then derive the TS type with `z.infer` — never maintain the type by hand.

```ts
export const goalSchema = z.object({ name: z.string().trim().min(1).max(200), … });
export type GoalInput = z.infer<typeof goalSchema>;   // single source of truth
```

See `lib/validators/goal.ts`, `lib/validators/brandDna.ts`.

---

## Type Organization

- **Validator types** (`GoalInput`, `KpiItem`, `BrandDnaInput`) live in `lib/validators/*`
  and are imported across client + server. This is the shared contract.
- **Prisma types** come from the generated client (`@prisma/client`) — do not re-declare
  entity shapes by hand.
- **Enum unions** are inferred from the `as const` tuples in `lib/constants.ts`
  (`type Objective = (typeof OBJECTIVES)[number]`). Do not write string-literal unions
  separately — they'd drift from the runtime source.
- Local, single-use prop/config types stay inline in the component file (e.g. the
  `{ key; label; long? }[]` field configs in `BrandDnaForm.tsx`).

---

## Validation Boundaries

- **Every server action / route handler validates input** with `safeParse` before using
  it, and returns a typed result on failure (see backend error-handling.md).
- **AI output** is validated with a zod `outputSchema` whose enum fields use the exact
  `z.enum([...])` values from `lib/constants.ts`. Repair-once on failure, then fail loudly —
  never silently coerce.
- Client-collected drafts may be `Partial<…>` while editing; the full schema validates at
  the save boundary, not on every keystroke.

---

## Common Patterns

- `z.coerce.date()` / `z.coerce.number()` for form/string inputs.
- `.trim()` + `.max()` on free-text; `.optional()` for non-required fields.
- Ratio maps: `z.record(z.string(), z.number().min(0).max(100))` — but the
  normalize-to-100 happens in **code**, not trusted from the model.
- Derive draft variants with `Omit<…>` + narrower field types when the UI needs strings
  (see `GoalDraft` in `lib/stores/onboarding.ts`).

---

## Forbidden

- `any`. Prefer `unknown` + a zod parse or a type guard.
- Unchecked `as` assertions to force a shape. The `as unknown as {…}` in `lib/db.ts` is a
  deliberate, isolated singleton guard — not a pattern to copy into feature code.
- Hand-written duplicates of a zod-inferred or Prisma-generated type.
