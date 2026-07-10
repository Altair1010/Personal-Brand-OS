# Desktop Packaging Contract (M11 + M12)

Executable contract for the Electron desktop shell. Infra / cross-layer → code-spec depth mandatory.

---

## Scenario: Cross-platform desktop runtime + packaging

### 1. Scope / Trigger
- Trigger: infra integration (Electron process boots the Next server; DB path/secrets/env wiring;
  installer build). Spans runtime (M11) and packaging (M12).
- Constraint: no web behavior/entity/feature change. Only `electron/`, `electron-builder.*`,
  `.github/workflows/*`, `next.config.*`, and DB-path/first-run wiring are in scope.

### 2. Signatures
- `electron/main.js` (M11): boots the Next production server as an Electron-node child process.
  - Server spawn: `spawn(process.execPath, [standaloneServerJs], { env: { ELECTRON_RUN_AS_NODE: '1', PORT, DATABASE_URL, ... } })`.
  - Production uses Next `output: 'standalone'` → `.next/standalone/server.js`. No dependence on `node_modules/next/bin`.
- `next.config.*` (M11): `output: 'standalone'`; keep `serverExternalPackages: ['pdf-parse','pdfjs-dist','mammoth']`.
- `package.json` scripts (M12): `dist`, `dist:win`, `dist:mac` → `electron-builder`.

### 3. Contracts
- **DB path (`DATABASE_URL`)**:
  - dev → `file:./prisma/dev.db` (unchanged).
  - production/packaged → `file:<app.getPath('userData')>/pbos.db`. Never write into the read-only install dir.
- **First-run (production)**: run `prisma migrate deploy` before creating the window; seed only if DB is empty.
- **API key**: resolved at runtime from AIModelConfig/Settings (M10) or an env the shell injects.
  MUST NOT read a repo-relative `.env` path in app code (project rule 3; key stays server-side).
- **electron-builder config env**:
  - Win: `target: nsis`, `nsis.createDesktopShortcut: true`, `createStartMenuShortcut: true`, `icon: build/icon.ico`.
  - Mac: `target: dmg`, `icon: build/icon.icns`, `mac.identity: null` (unsigned).
  - `asarUnpack`: Prisma query engines + `pdf-parse`/`pdfjs-dist`/`mammoth` + standalone server.
  - `extraResources`: Prisma migrations + seed (needed by first-run).
- **CI**: `.github/workflows/desktop-build.yml`, trigger `push: tags: ['v*']`.
  - job `windows-latest` → `.exe`; job `macos-latest` → `.dmg`; upload as artifacts / Release.

### 4. Validation & Error Matrix
| Condition | Behavior |
|-----------|----------|
| Production build missing (`.next/standalone` absent) | main.js aborts with clear error; do not open blank window |
| userData DB dir missing | create it before setting `DATABASE_URL` |
| First-run `migrate deploy` fails | surface error, do not open window against an unmigrated DB |
| App code reads repo `.env` | FORBIDDEN — fails project rule 3 (scope-guard flags) |
| Prisma engine binary missing in package | `asarUnpack` misconfigured; Prisma throws at query time |
| Building `.dmg` on Windows | not supported — electron-builder cannot cross-build Mac; use `macos-latest` CI |

### 5. Good / Base / Bad Cases
- **Good**: `npm run build` → Electron boots standalone server via Electron node, DB at userData,
  first-run migrate ran, window loads production app; installer produces shortcut + icon.
- **Base**: dev unchanged (`npm run app` still works against `next dev` during M11 dev, `prisma/dev.db`).
- **Bad**: hardcoding `prisma/dev.db` in runtime, reading repo `.env`, signing skipped but
  `mac.identity` left default (build tries to sign and fails), cross-building Mac from Win.

### 6. Tests Required
- Manual (M11): launch production build in Electron on Win → assert window loads, DB file exists
  under userData, migrate ran (tables present), AI call uses runtime key (no repo `.env`).
- Manual (M12): install `.exe` on Win → assert Desktop shortcut + icon exist, app launches,
  reads/writes userData DB. CI: assert `macos-latest` job emits a `.dmg` artifact.
- Regression: existing `vitest run` suite stays green (no web behavior change).

### 7. Wrong vs Correct
#### Wrong
```js
// electron/main.js — depends on node_modules layout + dev server, writes DB into install dir
spawn('node', [path.join(ROOT, 'node_modules/next/dist/bin/next'), 'dev']);
// DATABASE_URL left as ./prisma/dev.db in packaged app (read-only dir) → write fails
```
#### Correct
```js
// Boot standalone server with Electron's own node; DB in a writable per-user dir
const dbPath = path.join(app.getPath('userData'), 'pbos.db');
process.env.DATABASE_URL = `file:${dbPath}`;
// runFirstRunMigrate() -> prisma migrate deploy, then:
spawn(process.execPath, [standaloneServerJs], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', PORT, DATABASE_URL: process.env.DATABASE_URL },
});
```

---

## Design Decision: Ship unsigned

**Context**: Signing removes SmartScreen (Win) / Gatekeeper (Mac) warnings but requires paid certs
(Win ~hundreds $/yr, Apple $99/yr).

**Decision** [2026-07-11]: ship **unsigned**. Single-user/personal app; accept the OS warnings
(Win: "More info > Run anyway"; Mac: right-click > Open once). Set `mac.identity: null`; no Win sign config.

## Design Decision: Mac artifact via GitHub Actions

**Context**: electron-builder cannot cross-build a macOS `.dmg`/`.app` from Windows.

**Decision**: build the Mac artifact on a GitHub Actions `macos-latest` runner (Apple hardware in
cloud), triggered on `v*` tags. Requires pushing the repo to a GitHub remote (currently none — see
`ToFill.md`). Win artifact builds locally.
