# Work Order — PIL-WO-20260906-007-personal-codex-worker-bridge

## Objective

Implement P4 as a bounded Personal Codex Worker and secure App Server bridge between the canonical P3 durable control plane and the Owner's local Codex runtime.

## Authorized scope

- Freeze machine-authentication, Worker transport, execution-envelope, local repository authority, CodexRuntimePort, reconnect, and cancellation contracts.
- Implement the smallest secure P4 Worker/runtime integration supported by the canonical package and current local Codex installation.
- Use P3 exact tenant grants, capabilities, Worker state, and current lease as independent authority checks.
- Run the required security, failure, live App Server, regression, and remote-branch verification gates.

## Non-goals

No P5 role/context/permission compiler, generic remote shell, raw Codex JSON-RPC proxy, arbitrary remote filesystem path, production deployment, VPS, broker, master mutation, or history rewrite.

## Base

- Canonical master: `cb5c53c85d703ab5c83e13e921007e85ddc316a0`
- Branch: `work/PIL-WO-20260906-007-personal-codex-worker-bridge`
- P4 entry gate: derived PASS from verified P3 canonical evidence.

## Contract and security gate

The Owner approved the R1 machine-authentication and transport contract on 2026-09-06: a public lookup ID plus random 256-bit bearer secret, verifier-only server persistence, maximum 90-day lifetime, immediate revocation, maximum 10-minute same-Worker rotation overlap, and one outbound authenticated HTTPS polling/long-polling transport. `P4_MACHINE_AUTH_CONTRACT_PROPOSAL.md` and ADR-0003 are APPROVED.

The approved exact Next.js and matching ESLint configuration upgrade to 15.5.25 passed the required regression and reachability-based audit. The P4 security/contract entry gate is PASS; bounded P4 implementation may resume on this branch.

## P4-G6 phase release candidate gate

The Owner authorized a final release-only verification gate from reviewed phase SHA
`c169c33c2e3b1e39fc8c75916aa27e1c5f20157d`. The gate must publish a remote checkpoint before
verification, quantify the G5 migration on a disposable clone, run two independently
process-bounded real Codex proofs, execute phase-level security and regression checks, and
integrate only passing release evidence back into the phase branch by strict fast-forward.

This authorization does not permit product feature expansion, production deployment, production
database migration, P5 work, or phase-to-master integration. Canonicalization remains a separate
explicit Owner decision.
