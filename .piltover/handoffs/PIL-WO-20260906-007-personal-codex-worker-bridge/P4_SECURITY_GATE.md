# P4 Dependency Security Gate

## Status

PASS

## Evidence

The pre-remediation `npm audit --json` execution on 2026-09-06 reported:

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

## Remediation

Owner-approved exact upgrades were applied through normal npm resolution:

- `next`: 15.3.4 to 15.5.25.
- `eslint-config-next`: 15.3.4 to 15.5.25.
- React, Prisma, AI SDKs, Electron, and other direct dependency declarations were unchanged.
- No forced audit repair or broad dependency modernization was used.

The official Next.js security guidance requires a patched stable release for the React Flight RCE, and the GitHub advisory identifies 15.5.7 as the first patched 15.5 release. Version 15.5.25 is beyond that threshold. The fresh npm audit confirms that GHSA-9qr9-h5gf-34mp is absent.

## Post-remediation audit

- All dependencies: 27 advisories: 4 moderate, 22 high, 1 critical.
- Production install audit: 11 advisories: 4 moderate, 7 high, 0 critical.
- Critical Next.js React Flight RCE: REMOVED.
- Remaining critical `tar`: transitive through Electron packaging/build tooling; development-only and not reachable from the P4 Worker HTTP/runtime request path.
- Remaining high Prisma CLI/build packages: development and migration tooling, not Worker request runtime.
- Remaining high PostCSS and optional Sharp findings under Next: build/CSS and image-optimization paths; the approved P4 JSON Worker polling boundary performs neither CSS processing nor image optimization.
- P4-reachable Critical/High blocker: NONE.

## Regression evidence

- P1 architecture: 1 file / 6 tests PASS.
- P2 critical: 6 files / 49 tests PASS.
- P3 critical: 10 files / 70 tests PASS.
- Full repository: 40 files / 237 tests PASS with `maxWorkers=1`.
- Production build: PASS on Next.js 15.5.25.
- Prisma validate: PASS.
- Standalone TypeScript: the two canonical TS2352 diagnostics remain; new diagnostics = 0.
- Parallel baseline note: `maxWorkers=4` produced SQLite fixture hook timeouts on this Windows host; the same unmodified assertions pass sequentially before and after the upgrade.

## Gate decision

P4 SECURITY GATE: PASS. This decision permits bounded P4 implementation on the phase branch; it does not authorize deployment or imply that unrelated build/package advisories are resolved.

## Sources

- https://github.com/advisories/GHSA-9qr9-h5gf-34mp
- https://nextjs.org/blog/security-update-2025-12-11
- https://nextjs.org/blog/next-15-5
