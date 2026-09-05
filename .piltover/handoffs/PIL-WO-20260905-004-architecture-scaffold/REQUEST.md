# PIL-WO-20260905-004 — P1 architecture scaffold

## Objective

Establish the minimum executable Piltover modular-monolith scaffold in the existing PBOS
repository without changing existing product behavior.

## Authorized execution

- Base P1 on canonical post-P0.2 `master` at
  `342816cebb64cd2701931fba84c3d2e10bc6495a`.
- Work on `work/PIL-WO-20260905-004-architecture-scaffold`.
- Create module roots, dependency enforcement, shared contracts, justified core ports, an
  ErrorEnvelope, a feature-flag primitive, and an ADR mechanism.
- Use the existing TypeScript/Vitest toolchain and reversible local changes.

## Acceptance

- All twelve canonical module roots exist under one bounded Piltover namespace.
- New Piltover domain code is protected from provider/framework imports and illegal layer
  direction by deterministic, non-vacuous tests.
- Canonical core-port vocabulary exists; method contracts are limited to stable semantics.
- ErrorEnvelope and feature-flag contracts are framework/provider independent and tested.
- The ADR mechanism follows the canonical Piltover lifecycle and required record fields.
- Existing tests and production build pass, and the final diff is P1-only.

## Non-goals

No PBOS feature migration, route/UI behavior change, Prisma/schema/migration change, tenancy,
RBAC, provider selection, Worker, Agent Control Plane, MCP, microservices, event broker,
monorepo tooling, dependency addition, or unrelated cleanup.

## Owner gate evidence

The Owner approved the exact fast-forward-only reconciliation of canonical P0.2 to
`origin/master`. Post-push verification established `HEAD == origin/master`, ahead/behind
`0/0`, complete P0 through P0.2 ancestry, and the canonical three-file root Markdown state.
