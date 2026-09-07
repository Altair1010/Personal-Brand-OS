# P4 — PERSONAL CODEX WORKER + SECURE APP-SERVER BRIDGE

STATUS:
TECHNICALLY_COMPLETE

## BASE

Canonical P3 master: `cb5c53c85d703ab5c83e13e921007e85ddc316a0`.

Branch: `work/PIL-WO-20260906-007-personal-codex-worker-bridge`.

Implementation head before evidence closeout: `4e0922670bdef5a9399d17723748cd8edd905421`.

## APPROVED CONTRACTS

ADR-0003 and `P4_MACHINE_AUTH_CONTRACT_PROPOSAL.md` are APPROVED. P4 uses a 256-bit opaque bearer credential with a public lookup ID, SHA-256 verifier-only storage, 90-day maximum lifetime, immediate revocation, and at most ten minutes of same-Worker rotation overlap. Transport is Worker-initiated authenticated HTTPS polling only.

## MACHINE AUTHENTICATION

`WorkerCredential` is additive and contains no plaintext secret. Issuance uses cryptographically secure randomness and returns plaintext once. Authentication uses constant-time verifier comparison. Rotation is atomically single-success, preserves Worker identity, and cannot exceed the immutable credential-family expiry. Human issue and credential-record revoke require `agent.manage` across every active exact Worker grant. Tenant-local removal uses exact grant revocation. Authentication yields identity only; Worker ACTIVE state, capability, exact tenant grant, P2 ancestry, and current lease remain independent conditions.

## TRANSPORT

Eight strict, versioned routes implement heartbeat, polling/claim, execution-envelope retrieval, mark-running, lease renewal, event append, result submission, and reconnect. Every request authenticates independently, enforces a 16 KiB body limit, returns a safe ErrorEnvelope, and is default-disabled by feature governance. There is no WebSocket, SSE Worker channel, inbound workstation port, raw shell, arbitrary executable/environment map, or raw Codex RPC route.

## EXECUTION ENVELOPE

The envelope is current-lease-bound and revalidates Worker state, capabilities, exact grant, ancestry, and executable Run/Job state. It exposes only leased task data, opaque P5 references, and an opaque repository alias. It cannot retrieve an arbitrary Run or local path.

## PERSONAL WORKER

The outbound Worker performs heartbeat, claim, envelope fetch, local alias resolution, mark-running, bounded runtime execution, ordered safe event projection, lease renewal/reconnect checks, authority-loss interruption, and terminal result submission. Server truth wins after restart, revoke, disable, expiry, reclaim, or cancellation.

## LOCAL REPOSITORY SECURITY

Remote input selects only a constrained alias. Local resolution uses final real paths and rejects absolute input, traversal, unknown aliases, Windows case escape, and junction/symlink escape. The live proof used a disposable Git repository.

## CODEX RUNTIME

Installed runtime: `codex-cli 0.153.4`. The adapter follows the locally generated App Server schema. Application code exposes semantic `CodexRuntimePort` operations only. Infrastructure invokes a fixed local Codex module with executable-plus-argv and no shell, separates protocol stdout from stderr, bounds frames and lifecycle timeouts, removes Piltover machine credentials from the child environment, and fails closed on approval requests.

## LIVE POC

PASS. A real App Server execution traversed P3 Run/Job persistence, authenticated Worker credential, atomic claim/lease, execution envelope, local mapping, Codex execution, durable RunEvents, terminal RunResult, and P3 COMPLETED state. Only a disposable fixture received `PILTOVER_P4_POC.txt`; no master, push, deploy, or production data was touched.

## MIGRATION

`20260906070000_add_piltover_worker_credentials`: fresh database PASS; populated P3 database PASS; second deploy PASS; P2/P3 counts unchanged. Existing migrations were not edited.

`20260908010000_add_worker_credential_family_expiry` is a new forward-only migration. It adds non-null `familyExpiresAt` and backfills every existing connected rotation chain to the minimum existing record expiry in that chain. This is the narrowest fail-closed bound when the original pre-R2 horizon is no longer reconstructable, and it never extends an existing record expiry.

## G5 MACHINE IDENTITY AUTHORITY CLOSURE

- cross-tenant issuance: targeted falsifier PASS; A-only actor cannot mint for Worker A+B, no credential or issuance audit is created.
- cross-tenant global revoke: targeted falsifier PASS; A-only actor cannot revoke a credential serving B.
- tenant local revoke: targeted falsifier PASS; exact A grant revoke removes A authority while B and the credential remain unchanged.
- rotation family bound: targeted falsifier PASS across repeated near-expiry rotations.
- stolen credential horizon: targeted falsifier PASS; bearer-only possession cannot extend family expiry, issue a fresh family, revoke tenant grants, or change capabilities.
- migration: targeted forward-migration and legacy-chain backfill PASS.
- live POC: PASS; the explicit live-only test completed 1/1 in 132.83 seconds, and no matching App Server process remained afterward.
- regression: PASS; P4, P3, P2, P1 architecture, full repository, production build, Prisma validation, TypeScript delta, diff check, and secret scan completed without a G5 regression.

## SECURITY

Next.js and `eslint-config-next` remain exactly 15.5.25. Final audit: complete tree 27 advisories (4 moderate, 22 high, 1 critical); production tree 11 (4 moderate, 7 high, 0 critical). The blocking Next.js React Flight RCE is absent. Remaining Critical/High findings are not materially reachable through this Worker JSON boundary and remain explicit debt. Secret scan found no credential, API key, or private key material.

## VERIFICATION

- P4 targeted default: 6 files / 23 tests PASS; the separate live file is skipped unless explicitly enabled.
- P4 real live POC: 1 file / 1 test PASS.
- P3 critical: 10 files / 70 tests PASS.
- P2 critical: 6 files / 49 tests PASS.
- P1 architecture: 1 file / 6 tests PASS.
- Full repository: 46 files PASS, 1 live file skipped; 260 tests PASS, 1 skipped.
- Production build: PASS on Next.js 15.5.25; all eight P4 routes compiled.
- Prisma format/validate/generate: PASS.
- Standalone TypeScript: two historical TS2352 diagnostics unchanged; new diagnostics = 0.
- `git diff --check`: PASS.
- Dependencies added: NONE.

## SCOPE AUDIT

P5: NO. UI: NO. deployment/VPS: NO. production migration: NO. generic remote shell: NO. public raw Codex JSON-RPC: NO. Codex/OpenAI credential persistence: NO. master mutation: NO.

## LIMITATIONS

Bearer replay risk remains within the bounded credential lifetime; TLS, rotation, revocation, body limits, default-disabled exposure, idempotency, and lease fencing constrain it. Polling is used instead of push. Remaining dependency advisories require renewed reachability triage before packaging/deployment.

## CANONICALIZATION

PENDING OWNER GATE.

## PERMANENT GIT LIFECYCLE

Every future master prompt receives one remote `gate/PX-Gn-*` branch created from the current `phase/PX-*` branch and pushed before implementation. A passing gate is committed, pushed, remotely verified, and then integrated into its phase branch under the authorized strategy. A phase becomes `CANONICAL_DONE` only after all gates, phase regression, Owner Gate, controlled phase-to-master integration, and remote master verification. No remote gate means the gate is not done; no integrated phase means the phase is not technically complete; no verified master integration means the phase is not canonical.

## NEXT LEGAL PHASE

P5 remains BLOCKED until P4 is CANONICAL_DONE.
