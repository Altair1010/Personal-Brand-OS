# P4 — PERSONAL CODEX WORKER + SECURE APP-SERVER BRIDGE

STATUS:
IN_PROGRESS

## BASE

P4 started from verified canonical P3 master `cb5c53c85d703ab5c83e13e921007e85ddc316a0` on the dedicated Work Order branch.

## CONTRACTS

P4 MACHINE AUTH CONTRACT: APPROVED. The approved credential separates a public lookup identifier from a random 256-bit bearer secret, stores only a SHA-256 verifier server-side, expires within 90 days, supports immediate revocation, and limits same-Worker rotation overlap to 10 minutes.

P4 TRANSPORT CONTRACT: APPROVED. P4 R1 uses Worker-initiated authenticated HTTPS polling/long-polling only. The Owner workstation exposes no inbound port.

## SECURITY GATE

P4 SECURITY GATE: PASS. Exact `next` and `eslint-config-next` were upgraded from 15.3.4 to 15.5.25. The critical React Flight RCE is absent from the post-patch audit. Remaining Critical/High findings are not materially reachable through the approved P4 Worker JSON polling boundary; their build, packaging, migration-tool, CSS, and image-processing debt remains recorded in `P4_SECURITY_GATE.md`.

## IMPLEMENTATION

READY_TO_RESUME. No Worker endpoint, schema, migration, application service, Personal Worker, or Codex adapter has been implemented as part of gate resolution. The only dependency mutation is the approved exact Next.js security baseline.

## VERIFICATION

- P3 canonical preflight: PASS.
- Work Order 007 uniqueness: PASS.
- Installed Codex discovery: `codex-cli 0.153.4`; `codex app-server --help` PASS.
- Dependency audit: executed; security gate BLOCKED.
- Baseline P1: PASS — 1 file / 6 tests.
- Baseline P2 critical: PASS — 6 files / 49 tests.
- Baseline P3 critical: PASS — 10 files / 70 tests.
- Baseline full repository: PASS — 40 files / 237 tests with `maxWorkers=1`.
- Post-patch P1/P2/P3/full: PASS with the same counts.
- Production build: PASS on Next.js 15.5.25.
- Prisma validate/generate: PASS.
- Standalone TypeScript: two historical TS2352 diagnostics unchanged; new diagnostics = 0.
- Parallel execution note: four-worker full-suite attempts encountered SQLite fixture hook timeouts on this host; sequential execution passed the unchanged assertions before and after remediation.
- Live POC: not yet attempted; implementation has not started.

## SCOPE

P5, deployment, VPS, generic remote shell, and raw Codex JSON-RPC proxy are excluded.

## CANONICALIZATION

NOT STARTED

## ENTRY GATE

P4 SECURITY/CONTRACT ENTRY GATE: PASS.

The same P4 Work Order may resume at the lease-bound WorkerExecutionEnvelope. P5 remains excluded.
