# Piltover Outcome Horizons — 2026-09-22 Rebase

Status: CURRENT ROADMAP  
North-star progression: **DEMO → BETA → OFFICIAL**

## Product maturity model

```text
H1 — DEMO
Demonstrable Marketing OS
Status: DONE
        ↓
H2 — BETA
Connected, repeatable real-world operation
Status: NEXT
        ↓
H3 — OFFICIAL
Stable, secure, recoverable, deployable product
Status: PLANNED
```

## Horizon controller rule

A horizon is closed by outcome evidence, not backlog completion.

```text
current evidence
→ gap to maturity objective
→ minimum sufficient work
→ failure-path verification
→ promotion gate
```

Existing vNext capability is reused. It is not rebuilt merely because it appeared in an older roadmap.

## H1 — DEMO — DONE

H1 proved:

- canonical Brand → Strategy → Content → Campaign → Performance → Review journey;
- real AgentExecutionGateway → Agent Control Plane → OpenClaw execution;
- structured artifact validation and domain persistence;
- version-pinned Agent/Prompt/Skill execution;
- audit/provenance;
- production build and canonical route closure.

Fresh closure evidence is in:

- `docs/h1-demonstrable-vertical-slice-map.md`
- `docs/h1-agent-boundary-audit.md`

## H2 — BETA — NEXT

Objective:

> Real provider connections, real scheduled publishing, live analytics/search data, multi-brand isolation, operator recovery and repeatable beta usage without engineering intervention.

Five phases:

1. H2.1 Connection Fabric & Provider Onboarding
2. H2.2 Durable Scheduling & Real External Execution
3. H2.3 Live Data, Attribution & Search Intelligence
4. H2.4 Multi-Brand Beta Governance, Recovery & Operator UX
5. H2.5 Beta Closure & Soak

Promotion gate: `DEMO → BETA`.

Detailed plan:
`docs/h2-connected-usable-beta-vnext.md`

## H3 — OFFICIAL — PLANNED

Objective:

> Productionize the connected beta into a stable, secure, recoverable, observable, deployable and supportable official product.

Five phases:

1. H3.1 Reliability, Reconciliation & Recovery
2. H3.2 Security, Tenant Isolation & Governance
3. H3.3 Release Engineering, Deployment, Upgrade & Rollback
4. H3.4 Observability, Diagnostics & Production UX
5. H3.5 Release Candidate, Official Promotion & Operational Handoff

Promotion gate: `BETA → OFFICIAL`.

Detailed plan:
`docs/h3-operational-product-vnext.md`

## Cross-horizon invariants

- Piltover remains Source of Truth + product shell + control-plane authority.
- OpenClaw is an execution route, not a second domain runtime.
- No hidden second Agent runtime.
- Agent/Prompt/Skill versions are pinned to runs.
- MarketingProjectContext is the canonical shared marketing context.
- Tool access is explicit, scoped and default-deny.
- High-impact external actions are approval-aware.
- Provider facts/deterministic measurement remain separate from LLM interpretation.
- Unknown external state is never represented as success.
- Migrations are additive/controlled; no destructive reset as a shortcut.
- Learning produces Evidence/Recommendation before production mutation.
- MMM remains data-maturity gated.
- Horizon claims follow evidence: H1=Demo, H2=Beta, H3=Official.
