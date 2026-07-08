# Quality Guidelines

> Backend / server-side code quality standards for Personal Brand OS.

---

## Required Patterns

- **DB access via `lib/db.ts` singleton** only.
- **Validate at every boundary**: server actions and route handlers `safeParse` input
  before use. AI output validated by a zod `outputSchema`.
- **Typed results** from server actions (`{ ok, data } | { ok, error }`); status + JSON
  error from route handlers.
- **Idempotent writes**: upsert on stable keys; seed is idempotent.
- **AI pipeline (fixed order)**:
  `validateInput → sanitizeExternal → call(low temp for structured) →
  validateOutput(zod enum) → repairOnce → savePromptRun`.

---

## Forbidden Patterns

- **AI on the client** — API key must never reach client code; all AI is server-side.
- **External text unsanitized** — upload/paste passes `lib/ai/sanitize.ts` and is framed
  as DATA, not instructions (injection guard), before any AI call.
- **Hardcoded model names** — model comes from `AIModelConfig` / Settings.
- **Enums defined outside `lib/constants.ts`**, or AI enum output not validated by
  `z.enum`.
- **Ratio trusted from the model** — normalize to 100 in code.
- **30-day strategy as one giant JSON** — generate per-week (D.4 arc → D.6 weekly) then
  merge, to avoid truncation.
- **`new PrismaClient()`** outside the singleton.
- **Entities / routes / files outside MVP scope** (22 entities, 8 tabs, 30-day,
  manual-first).

---

## Build Gate

`npm run build` passes with **no type errors** · `npx prisma validate` clean · seed run
twice = identical state. Part of the milestone Done gate.

---

## Testing

Targeted, not blanket. AI modules get `tests/prompts/<moduleKey>.test.ts` against their
Eval check (per the module's D.x spec). Don't add speculative tests outside a milestone's
requirement.

---

## Code Review Checklist

- [ ] Input validated (`safeParse`) at the boundary; typed result returned.
- [ ] DB via singleton; writes idempotent; attribution/versioning invariants held.
- [ ] AI: server-side, sanitized external data, enum-from-constants, low temp for
      structured, repair-once, `savePromptRun`, no hardcoded model.
- [ ] Ratio normalized in code; strategy generated per-week then merged.
- [ ] No phase-2 scope creep; no new entities beyond the 22.
