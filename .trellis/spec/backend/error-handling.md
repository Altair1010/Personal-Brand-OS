# Error Handling

> Server-side error conventions for Personal Brand OS.

---

## Server Actions — typed result, no throw

Server actions return a **discriminated result**, they don't throw to the client:

```ts
type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };
```

Pattern (see onboarding `actions.ts`):

1. `schema.safeParse(input)` — validate first.
2. On failure, return `{ ok: false, error: parsed.error.issues[0]?.message ?? "…" }`
   with a **Vietnamese** user-facing message.
3. On success, do the DB work, `revalidatePath(...)`, return `{ ok: true, data }`.

The client branches on `result.ok` and shows `result.error` — no try/catch around the
action call for control flow.

---

## Route Handlers — status + JSON error

Route handlers (`app/api/**/route.ts`) return `NextResponse.json({ error }, { status })`
with the right HTTP code. From `app/api/upload/route.ts`:

- `400` missing/invalid input · `413` too large · `415` unsupported type ·
  `422` unprocessable (parse failed) · `200` success.
- Wrap fallible parsing in `try/catch`; on catch return a `422` with a
  user-actionable Vietnamese message ("Không đọc được file — vui lòng nhập tay.").
- Validate shape defensively: `if (!(file instanceof File))` before use.

---

## AI Calls — validate + repair-once

For AI modules (M4+): validate output against the zod `outputSchema`; on failure call the
repair prompt **exactly once**, then **fail loudly** if still invalid. Never silently
coerce a bad model response into a valid-looking object. Persist every run via
`savePromptRun` for debugging.

---

## Messages

- **User-facing error strings are Vietnamese** (matches the app UI language).
- Keep the raw exception server-side; return a clean message, not a stack trace.
- Prefer the first zod issue's message; fall back to a generic Vietnamese sentence.

---

## Common Mistakes

- Throwing from a server action instead of returning `{ ok: false }`.
- Returning `200` with an error body (breaks client branching).
- Leaking a stack trace / raw exception text to the client.
- Silently coercing invalid AI output instead of repair-once-then-fail.
