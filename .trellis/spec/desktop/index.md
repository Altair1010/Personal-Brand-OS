# Desktop (Electron) Guidelines

> Contracts for wrapping the Next.js web app as a cross-platform desktop app (M11 + M12).

---

## Overview

"Desktop" = the Electron shell under `electron/` that boots the **existing** Next.js server and
points a window at it. It MUST NOT change any web behavior, entity, or feature scope. This is
historical PBOS implementation evidence, not Piltover authority. Split across two milestones:

- **M11 — runtime cross-platform**: boot the production build in Electron on Win + Mac; relocate
  SQLite to the OS user-data dir; first-run `prisma migrate deploy`; API key from runtime.
- **M12 — packaging (unsigned)**: NSIS `.exe` (Win, local) + `.dmg` (Mac, via GitHub Actions).

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Packaging Contract](./packaging-contract.md) | Runtime boot, DB relocation, first-run migrate, electron-builder, CI, unsigned | Filled |

---

**Language**: All documentation written in **English**.
