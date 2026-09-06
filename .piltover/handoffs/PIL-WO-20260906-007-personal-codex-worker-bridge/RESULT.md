# P4 — PERSONAL CODEX WORKER + SECURE APP-SERVER BRIDGE

STATUS:
BLOCKED_SECURITY_GATE

## BASE

P4 started from verified canonical P3 master `cb5c53c85d703ab5c83e13e921007e85ddc316a0` on the dedicated Work Order branch.

## CONTRACTS

The package requires authenticated outbound Worker connectivity but does not decide credential enrollment, verifier form, rotation, revocation, expiration, replay behavior, recovery, or exact web transport. `P4_MACHINE_AUTH_CONTRACT_PROPOSAL.md` freezes the shared invariants, compares three authentication options, recommends a bounded bearer-verifier POC plus HTTPS polling, and leaves four explicit Owner decisions. ADR-0003 is PROPOSED.

## SECURITY GATE

Fresh `npm audit --json` reports 27 advisories: 3 moderate, 22 high, and 2 critical. Direct production dependency Next.js 15.3.4 is affected by a critical React Flight protocol RCE that is materially reachable if P4 adds machine-facing App Router routes. npm reports Next.js 15.5.25 as the non-major remediation target. Public Worker mutation transport is blocked until the Owner approves a targeted update and full regression verification.

## IMPLEMENTATION

Not started. Schema, migration, dependency, application, Worker, transport, and Codex adapter mutation are all NONE.

## VERIFICATION

- P3 canonical preflight: PASS.
- Work Order 007 uniqueness: PASS.
- Installed Codex discovery: `codex-cli 0.153.4`; `codex app-server --help` PASS.
- Dependency audit: executed; security gate BLOCKED.
- Runtime tests/build/live POC: not run because implementation is prohibited before the unresolved Owner and security gates.

## SCOPE

P5, deployment, VPS, generic remote shell, and raw Codex JSON-RPC proxy are excluded.

## CANONICALIZATION

NOT STARTED

## BLOCKERS

1. Owner decision on machine authentication, credential lifecycle, and HTTPS polling.
2. Owner authorization for the smallest targeted Next.js security remediation and regression pass.
