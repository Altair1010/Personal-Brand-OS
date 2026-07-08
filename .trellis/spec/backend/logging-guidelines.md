# Logging Guidelines

> Logging conventions for Personal Brand OS.

---

## Context

Single-user local desktop app (Electron + Next.js server + SQLite). No external log
aggregation, no PII pipeline. Logging is lightweight and developer-facing.

- **Prisma query logging** is configured in `lib/db.ts`: `["error", "warn"]` in
  development, `["error"]` otherwise. Don't add `"query"` logging by default — it's noisy.
- Server errors are logged with `console.error` on the server; the client gets a clean
  Vietnamese message (see error-handling.md), never the raw trace.

---

## Levels

- **error** — a failed operation the developer must see (DB write failed, AI call
  unrecoverable after repair, unexpected exception). Use `console.error`.
- **warn** — recoverable/degraded (repair-once triggered, fallback taken).
- **info / debug** — sparingly, dev only. Remove before finishing a milestone; don't ship
  `console.log` debugging noise.

---

## AI Run Persistence (not console logging)

The audit trail for AI is **`savePromptRun`**, not console output: every AI call persists
`{ module, input, output, tokens }` to the DB for eval/debug. This is the durable record —
console logs are ephemeral dev aids.

---

## What to Log

- Server-side failures with enough context to locate them (operation + entity id).
- The decisive line of a caught exception, not the whole object dump.

---

## What NOT to Log

- **Secrets / API keys** — never. (Keys are server-side and must not appear in logs.)
- **Full uploaded/pasted user content** — it's DATA; log a length or file name, not the body.
- Raw stack traces to the client.
- High-volume per-query logs in production mode.
