# ADR-0003: P4 Worker Machine Authentication and Transport

## Status

PROPOSED

## Context

P4 introduces a machine-facing trust boundary between the hosted Piltover control plane and an outbound Personal Codex Worker. The canonical package requires authenticated, revocable Worker identity and resumable outbound connectivity, but leaves credential lifecycle, replay behavior, enrollment, storage, recovery, and exact transport as implementation choices. Worker registration, technical capabilities, exact tenant grants, and leases are already separate P3 authorities and must remain separate.

The current application pins Next.js 15.3.4. A fresh dependency audit reports a directly reachable critical React Flight protocol RCE in the affected range and recommends Next.js 15.5.25. No Worker route may be exposed before that security gate is cleared.

## Decision

Propose an opaque 256-bit bearer credential bound to exactly one Worker, transported only over HTTPS, stored server-side only as a SHA-256 verifier, expiring after 90 days by default, revocable immediately, and rotatable with no more than 10 minutes of overlap. Plaintext is delivered once through an Owner-controlled enrollment step and is never recoverable.

Propose Worker-initiated versioned HTTPS polling as the single P4 R1 transport. Every request is independently authenticated and every authoritative operation continues to enforce Worker state, capability, exact tenant grant, P2 ancestry, and current lease. Public routes remain default-disabled until the dependency-security gate passes.

This decision remains proposed until the Owner approves the auth lifecycle, transport, and targeted Next.js remediation.

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

G4 approval is required because this ADR establishes machine authentication, credential rotation/revocation, a public protocol, and a targeted dependency-security remediation. Approval authorizes only bounded P4 implementation on the P4 branch; it does not authorize deployment, production migration, master integration, P5, generic remote shell, or raw Codex JSON-RPC exposure.

## References and evidence

- `.piltover/handoffs/PIL-WO-20260906-007-personal-codex-worker-bridge/P4_MACHINE_AUTH_CONTRACT_PROPOSAL.md`
- `.piltover/handoffs/PIL-WO-20260906-007-personal-codex-worker-bridge/P4_SECURITY_GATE.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/06_CODEX_BRIDGE/BRIDGE_SPEC.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/06_CODEX_BRIDGE/PERSONAL_CODEX_WORKER.md`
- `docs/Piltover-Master-Technical-Package-v1.0.0/10_QUALITY/SECURITY_MODEL.md`
- `docs/adr/0002-worker-tenant-authorization.md`
- Fresh `npm audit --json` output recorded by the P4 Work Order on 2026-09-06.
