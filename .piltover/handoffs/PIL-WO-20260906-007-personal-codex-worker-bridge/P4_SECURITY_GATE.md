# P4 Dependency Security Gate

## Status

BLOCKED_SECURITY_GATE

## Evidence

Fresh `npm audit --json` execution on 2026-09-06 reported:

- total: 27
- moderate: 3
- high: 22
- critical: 2
- direct production dependency `next`: critical aggregate severity
- application version: Next.js 15.3.4
- audit-recommended patched version: 15.5.25

## P4 Reachability Triage

| Finding | Direct / transitive | Production / dev | P4 reachability | Patch | Gate |
|---|---|---|---|---|---|
| Next.js React Flight protocol RCE, GHSA-9qr9-h5gf-34mp | Direct (`next`) | Production | Materially reachable if P4 adds machine-facing App Router routes to the current Next server | Next.js 15.5.25 reported by npm audit | BLOCKING |
| Next.js request deserialization, Server Component DoS, middleware/proxy bypass, SSRF, and cache findings | Direct (`next`) | Production | Some are configuration-dependent; Worker transport enlarges the same network trust boundary | Next.js 15.5.25 reported by npm audit | BLOCKING until targeted upgrade and regression proof |
| PostCSS path/file disclosure findings | Direct and through Next | Build/runtime dependency path | Not part of the proposed JSON Worker payload path, but remains in the deployed graph | Included in npm's Next remediation path | Non-independent blocker |
| `tar` critical archive parser findings | Transitive through Electron build tooling | Development/packaging | P4 Worker HTTP/App Server path does not extract untrusted archives | Electron-builder path requires a breaking upgrade | Non-blocking for P4 network runtime; retain debt |
| Electron-builder, Prisma CLI, Browserslist, and related toolchain findings | Direct/transitive | Primarily development/build | Not on the proposed Worker request execution path based on current evidence | Mixed, some breaking | Non-blocking for contract gate; reassess before packaging/release |
| Undici cache/parser findings | Transitive | Production dependency graph | Proposed Worker client may use Node built-in fetch; exact reachability must be rechecked after implementation | Available | Pending implementation, not the present critical blocker |

## Blocking Decision

No public or machine-facing Worker mutation route may be added while the application remains on vulnerable Next.js 15.3.4. The smallest remediation is a targeted Next.js security update to 15.5.25, with lockfile-only dependency resolution changes, official advisory review, P1/P2/P3 regression, full tests, production build, standalone typecheck delta, and a fresh audit. Broad dependency upgrades and `npm audit fix --force` remain prohibited.

The remediation requires Owner authorization because the P4 instructions prohibit dependency remediation without a gate and the exact Next version is pinned.
