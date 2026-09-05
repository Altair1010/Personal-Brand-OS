# Piltover Architecture Decision Records

ADRs record consequential architecture decisions; they are not task status, implementation notes,
or TODO lists. Create one only when a change alters a trust boundary, canonical source of truth,
core protocol, database family, authentication model, permission semantics, worker trust model,
major dependency/framework, external-action policy, or public lifecycle/state machine.

## Lifecycle

```text
PROPOSED -> APPROVED | REJECTED
APPROVED -> SUPERSEDED
```

Only the Owner may approve a consequential decision at its required gate. Keep rejected and
superseded records as history; a replacement ADR references the record it supersedes.

## Creating a record

1. Copy `0000-template.md` to the next unused four-digit ID plus a short kebab-case title.
2. Start with status `PROPOSED`.
3. Complete every template section with evidence and a reversal path.
4. Identify the Owner gate, or state why none is required.
5. Do not mark the ADR `APPROVED` until the required Owner decision is durable.

Canonical policy: `docs/Piltover-Master-Technical-Package-v1.0.0/01_GOVERNANCE/CHANGE_AND_ADR_POLICY.md`.
