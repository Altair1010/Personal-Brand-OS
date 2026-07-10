# RULES.md — hard rules

## Hard stops (never do these without explicit user authorization)
- Do NOT delete or overwrite files you did not create without confirming first.
- Do NOT push straight to `main`; always branch + PR.
- Do NOT skip hooks or bypass signing (`--no-verify`, `--no-gpg-sign`).
- Do NOT send project content to external services without authorization.

## Secrets & API keys (never leak on push)
- NEVER put a real secret/API key in a tracked file (`.mcp.json`, `settings.json`,
  source, docs). Tracked files reference secrets ONLY via `${ENV_VAR}` placeholders.
- Real secrets live in `.claude/settings.local.json` under the `env` block — this file
  is gitignored (`.claude/.gitignore`). Claude Code injects `env` and expands the
  `${ENV_VAR}` placeholders in `.mcp.json` at MCP launch.
- Example: `.mcp.json` has `"CONTEXT7_API_KEY": "${CONTEXT7_API_KEY}"`; the real value
  sits in `settings.local.json` → `env.CONTEXT7_API_KEY`.
- Before any commit/push: verify no raw key (`ctx7sk-`, `sk-`, tokens) appears in
  `git diff --cached`. If found, move it to `settings.local.json` and re-placeholder.

## Code style
- Match the existing style. Surgical changes only (Karpathy §3). No out-of-scope refactors.
- Every changed line must trace directly to the user's request.

## Commit format
- Conventional-ish, concise. Commit body may be Vietnamese (per CLAUDE.md language policy).

## Compression order (ANTI-CONFLICT — the 4 layers are order-locked)
1. **headroom** CacheAligner: stabilize the prefix for cache hits. Runs earliest.
2. **rtk**: compress ONLY the OUTPUT of Bash/Grep/Glob (CLI). Never for file-read.
3. **token-optimizer-mcp / codebase-memory-mcp**: replace file-read/grep with smart_read + graph.
4. **caveman**: in-agent skill (auto-on). Trims PROSE in the RESPONSE only — never code/JSON.
> Each layer handles a DIFFERENT payload type -> never compress the same payload twice.

## STATE vs MEMORY (different jobs — never duplicate content)
- **STATE.md = a POINTER, time-axis.** Answers "where are we now / next / blocked".
  Sprint-level ONLY: milestone id + one-line status. It carries NO technical detail
  (no file names, migrations, test counts, patterns). It is overwritten as the sprint
  moves.
- **MEMORY.md = the RECORD, knowledge-axis.** Answers "why did we choose this / what
  pattern must hold". Append-only; one entry per milestone holds ALL the durable detail.
- **The handoff:** when a milestone passes, write the full detail as ONE MEMORY entry,
  then collapse it in STATE to a single pointer line (`Mx DONE — detail → MEMORY.md`).
  Never paste the same paragraph into both. If you catch STATE growing a technical
  paragraph, it belongs in MEMORY — move it.

## plan.md & todo.md lifecycle
- **Create** at task start (or reuse the existing files); do not start real work without them.
- **Update after every step**: tick todo.md items, append a plan.md checkpoint
  `[HH:MM] step -> verify result`.
- **Keep in sync**: plan.md (the how) <-> todo.md (the checklist) <-> STATE.md (the sprint view).
- **Never leave stale**: if you paused mid-task, the files must reflect reality.
- **Delete when done**: once the Done criteria are verified, remove plan.md and todo.md;
  promote any lasting decision into MEMORY.md.

## ToFill.md — user manual pre-launch actions
- The moment a milestone introduces something the USER must do by hand before the app can
  run for real (fill an API key/secret, choose a config value that isn't hardcodable, run a
  live smoke-test that needs a key), **append one line to `ToFill.md`** — grouped by category,
  with what / where / why / milestone. Tick items when the user confirms them done.
- `ToFill.md` is the single home for these; do not scatter them across STATE.md/MEMORY.md.
- NEVER write an actual secret value into `ToFill.md` (it is tracked) — reference the env key
  name only, per "Secrets & API keys" above.

## Agent escalation
- Same step fails twice in a row -> stop and ask the user.

## Project hard rules (Personal Brand OS — non-negotiable)
1. **Scope lock (MVP = 8 tab · 22 entity · 30-day · manual-first).** Never build phase-2
   features: Inspiration Lab, Experiments, Strategy 60/90-day, CSV import, Meta/FB API,
   auto-publish, Prompt/Framework editor, separate Company tab, TipTap/rich text.
2. **Enums come only from `lib/constants.ts`** (OBJECTIVES, HOOK_STYLES, CTA_INTENSITY,
   FORMATS, POST_STATUS), validated with `z.enum`. Never let the LLM invent enum values.
   Content ratio is normalized to 100 in CODE, never trusted from the model.
3. **AI is server-side only.** Never import the API key into client code. All external
   data (upload/paste) must pass `lib/ai/sanitize.ts` and is treated as DATA, not
   instructions. Never hardcode a model name — `AIModelConfig` is user-set in Settings.
4. **Every AI call follows the fixed pipeline:** `validateInput -> sanitizeExternal ->
   call(low temp for structured) -> validateOutput(zod enum) -> repairOnce ->
   savePromptRun`. No shortcut, no skipping the repair-once step.
5. **Review gate is mandatory.** The "Duyệt & tạo chiến lược" button is enabled only
   after the user confirms Persona + Pillar. Never auto-chain straight into Strategy.
6. **Attribution & versioning are mandatory.** Approving a draft creates a `Post` linked
   to `strategyVersionId` + `dailyPlanId`; `StrategyVersion.reason` is non-null on every
   direction change (the Revision Engine depends on it).
7. **Generate the 30-day strategy per-week then merge** (D.4 arc -> D.6 weekly) to avoid
   output truncation. Never emit one giant 30-day JSON.
8. **One milestone per `/clear` session.** A milestone is Done only when `npm run build`
   passes with no type errors, the milestone VERIFY passes, feature-spec acceptance is
   met, and the seed stays idempotent. Do not create files outside the current milestone.

## Approved scope exceptions (explicit user authorization — logged, not drift)
- **[2026-07-08] Desktop app (Electron), done AFTER the web MVP (M4→M10).** User wants a real
  local desktop app (icon/window), not just `npm run dev`. Wrapper lives under `electron/` and
  MUST NOT change any web behavior, entity, or feature scope — it only boots the existing Next
  server and points a window at it. scope-guard: treat `electron/` + electron devDeps + electron-
  builder config + `.github/workflows/*` as authorized; still flag any feature/entity creep.
  - **[2026-07-11] Split into two milestones (was one "M11 Phase A/B"):**
    - **M11 — runtime cross-platform:** boot the production build in Electron on Win + Mac;
      relocate SQLite to OS user-data dir; first-run `migrate deploy`; API key from runtime.
    - **M12 — packaging (unsigned):** NSIS `.exe` installer (Win, desktop shortcut + icon) built
      locally; `.dmg` (Mac) via GitHub Actions `macos-latest` (electron-builder cannot cross-build
      Mac from Win). **Decision: ship unsigned** — accept SmartScreen/Gatekeeper warnings; no cert.
  - **Packaging-friendly constraints for M4–M10 (enforce now so M11/M12 are just wrapping,
    not rework):**
    1. **No hardcoded absolute paths.** Uploads, backup files, DB, exports must resolve from
       a configurable base, never assume cwd == repo root. Packaged app cwd differs.
    2. **DB path relocatable.** Packaged app cannot write into its install dir — M11 moves
       SQLite to the OS user-data dir. Don't bake `./dev.db` assumptions into runtime logic;
       keep it behind `DATABASE_URL` (already so). No code hardcoding `prisma/dev.db`.
    3. **API key from runtime, not repo `.env`.** Packaged app ships no repo `.env`. The
       Anthropic key must be user-provided at runtime (Settings/AIModelConfig, M10) or an env
       the desktop shell injects — never read a repo-relative `.env` path in app code. Key
       stays server-side (project rule 3).
    4. **Backup/restore uses a user-chosen location (M10).** Export/import JSON must go through
       a path the user picks (file dialog), not a fixed cwd-relative file.
    5. **Node-only deps stay externalized.** `serverExternalPackages` (pdf-parse/pdfjs-dist/
       mammoth) — M12 `asarUnpack`s them. Don't move these into client bundles.