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

## Contract gate

The canonical package does not select Worker credential lifecycle semantics or a concrete web transport. These are consequential trust-boundary and protocol decisions. P4 implementation is blocked pending Owner review of `P4_MACHINE_AUTH_CONTRACT_PROPOSAL.md` and ADR-0003.

The current dependency audit also blocks machine-facing route exposure until the direct production Next.js critical advisory is remediated through an explicitly approved, targeted update.
