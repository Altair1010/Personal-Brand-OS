# ADR-0003: P4 Worker Machine Authentication and Transport

## Status

APPROVED

## Context

P4 introduces a machine-facing trust boundary between the hosted Piltover control plane and an outbound Personal Codex Worker. The canonical package requires authenticated, revocable Worker identity and resumable outbound connectivity, but leaves credential lifecycle, replay behavior, enrollment, storage, recovery, and exact transport as implementation choices. Worker registration, technical capabilities, exact tenant grants, and leases are already separate P3 authorities and must remain separate.

The current application pins Next.js 15.3.4. A fresh dependency audit reports a directly reachable critical React Flight protocol RCE in the affected range and recommends Next.js 15.5.25. No Worker route may be exposed before that security gate is cleared.

## Decision

Use an opaque bearer credential with a public lookup identifier separated from cryptographically random 256-bit secret material, conceptually `<credential-id>.<secret>`. Bind it to exactly one Worker, transport it only over HTTPS, and store server-side only the lookup identifier, Worker binding, SHA-256 secret verifier, and necessary lifecycle facts. Compare verifiers in constant time where applicable. The credential has a maximum 90-day lifetime, is immediately revocable, and may overlap its same-Worker replacement for no more than 10 minutes. Plaintext is delivered once through an Owner-controlled enrollment step and is never recoverable.

Use Worker-initiated versioned HTTPS polling/long-polling as the single P4 R1 transport. Polls and requests have finite timeouts and bounded retry/backoff policy. Every request is independently authenticated and every authoritative operation continues to enforce Worker state, capability, exact tenant grant, P2 ancestry, and current lease. The Owner workstation exposes no inbound port. No WebSocket, SSE Worker channel, gRPC, raw TCP, remote shell, or raw Codex JSON-RPC surface is introduced.

Machine authentication establishes Worker identity only. It does not grant tenant authority, capabilities, lease ownership, repository access, or Codex/OpenAI authority. Codex/OpenAI credentials remain entirely separate and local to the Codex runtime boundary.

The Owner approved this decision and the targeted exact upgrade of `next` and `eslint-config-next` from 15.3.4 to 15.5.25 on 2026-09-06 through P4 Gate Resolution R1. No broader dependency modernization was approved.

## Alternatives considered

- Ed25519 signed requests: stronger per-request replay resistance and public-key-only server storage, but requires canonical request signing, durable nonce uniqueness, clock-skew policy, key enrollment, and protected local private-key operations.
- Mutual TLS: mature mutual authentication, but requires certificate authority and proxy lifecycle infrastructure not present in the package or repository.
- WebSocket: lower cancellation latency, but adds connection-state complexity and a larger Next.js/security surface without measured P4 load evidence.
- Codex/OpenAI credentials: rejected because runtime authentication cannot identify or authorize a Piltover Worker.
- Worker ID alone: rejected because caller-controlled identity is not authentication.

## Consequences

- Initial machine authentication is simple, dependency-free, revocable, and non-recoverable from server persistence.
- Bearer credentials do not prevent replay after theft; the bounded POC accepts this only with HTTPS, expiry, redaction, rate/body limits, P3 idempotency, and lease fencing. A future signed-request scheme can supersede it additively.
- Polling preserves outbound-only topology and uses existing request/response infrastructure, with cancellation latency bounded by the polling interval.
- A targeted Next.js security upgrade and complete regression proof are mandatory before Worker route exposure.
- A new additive credential migration is expected only after approval; it does not alter P3 tenant grants or lease semantics.

## Migration and reversal plan

Before approval, reject or revise this ADR with no schema or runtime impact. After approval and security remediation, add credential persistence and versioned routes behind the existing feature-governance primitive. Disable the feature to stop network exposure. Revoke bearer credentials before migrating Workers to a future Ed25519 credential kind; retain audit chronology and do not reinterpret P3 grants or leases.

## Owner gate

G4 approval was granted for the bounded machine-authentication contract, the single outbound HTTPS polling transport, and the targeted Next.js 15.5.25 remediation. Approval authorizes only P4 gate resolution and, after its security and regression gates pass, bounded P4 implementation on the P4 branch. It does not authorize deployment, production migration, master integration, P5, generic remote shell, or raw Codex JSON-RPC exposure.

## References and evidence

- `.piltover/handoffs/PIL-WO-20260906-007-personal-codex-worker-bridge/P4_MACHINE_AUTH_CONTRACT_PROPOSAL.md`
- `.piltover/handoffs/PIL-WO-20260906-007-personal-codex-worker-bridge/P4_SECURITY_GATE.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/06_CODEX_BRIDGE/BRIDGE_SPEC.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/06_CODEX_BRIDGE/PERSONAL_CODEX_WORKER.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/10_QUALITY/SECURITY_MODEL.md`
- `docs/adr/0002-worker-tenant-authorization.md`
- Fresh `npm audit --json` output recorded by the P4 Work Order on 2026-09-06.
