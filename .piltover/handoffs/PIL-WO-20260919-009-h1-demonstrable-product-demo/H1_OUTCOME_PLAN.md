# H1 Outcome Plan — Demonstrable Product Demo

## 1. H1 product outcome

A user can run Piltover locally and complete one coherent marketing operating loop with persistent data and visible system state.

H1 is not a certification that every Piltover subsystem is production-ready. It proves that the existing architectural foundation can produce a usable, inspectable product journey.

## 2. Current baseline

The H1 branch starts from `origin/phase/P5-agent-control-plane` at `f641c74`.

Existing assets already include:

- P0–P4 canonical foundations;
- P5 Agent Definition / Role registry foundation;
- multi-tenant Organization / Workspace / Brand schema;
- RBAC and ownership boundaries;
- AgentRun / Job / Approval / Worker control-plane primitives;
- dashboard surfaces for onboarding, strategy, calendar, studio, review and performance;
- BrandDNA, Strategy, ContentIdea, ContentDraft, Post and PerformanceInsight data models;
- AI routes and adapters;
- Facebook account / post integration primitives;
- desktop packaging scripts.

H1 should reuse these seams before introducing new architecture.

## 3. Golden journey

The minimum H1 demonstration is:

```text
Create / select Brand
  → establish Brand DNA
  → define Goal + Strategy
  → create Campaign / Content Plan
  → create an approved creative/content asset
  → choose delivery path
      ├─ Organic
      └─ Paid / Ads
  → persist delivery state
  → record/import performance evidence
  → generate evidence-backed insight
  → feed the insight back into the next strategy decision
```

The journey must be navigable through the product UI, not only by direct database manipulation or isolated tests.

## 4. Paid / Ads scope in H1

Ads is part of the engine, not a detached feature.

H1 must demonstrate an internal paid-media path using shared Brand, Strategy, Creative, Evidence and Learning primitives:

- Campaign objective;
- audience/targeting definition;
- budget/bid intent;
- approved creative binding;
- delivery status;
- manually entered or fixture-backed performance metrics with explicit provenance;
- performance insight feeding the same learning loop as organic content.

Real ad-platform mutation, billing spend, live campaign launch and production OAuth are deferred to H2 unless already safely available.

## 5. Architecture × engine relation

```text
Brand Context
    │
    ├──────────────► Strategy Engine
    │                    │
    │                    ▼
    │              Campaign Planning
    │                    │
    │          ┌─────────┴─────────┐
    │          ▼                   ▼
    │      Organic Path        Ads Engine
    │          │                   │
    │          └─────────┬─────────┘
    │                    ▼
    │                Delivery
    │                    │
    │                    ▼
    │             Performance Data
    │                    │
    │                    ▼
    └────────────── Learning / Insight
                         │
                         └────────► next Strategy
```

Cross-cutting engines:

```text
Context → Reasoning → Orchestration → Agent/Skill/Tool
   ↑                                      │
   │                                      ▼
Memory/Learning ← Evidence ← Verification ← Execution
```

Core controls tenancy, RBAC, state, approvals and audit across all paths.

## 6. AMH v0.3 control card

OBJECTIVE:
Prove one visible end-to-end Piltover marketing loop from brand context to evidence-backed learning.

DONE:
H1 acceptance conditions in section 9 are demonstrated with proportional runtime evidence.

NON-GOALS:
- finish P5–P13 sequentially;
- production-grade ad buying;
- complete marketplace/licensing;
- every social platform;
- final production visual polish;
- speculative microservices or new infrastructure.

CONSTRAINTS:
- preserve tenant/RBAC/approval boundaries;
- no secret material in Git;
- no destructive external action without explicit authority;
- reuse current modular-monolith seams;
- real limitations must be visible, not hidden behind mocks.

ACTIVE ROUTE:
Close the shortest set of missing seams required by the golden journey.

NEXT SIGNAL:
The next runtime observation that can falsify or advance the golden journey.

## 7. Workstream model

Bounded workstreams may progress in parallel for inspection, implementation and evidence:

1. Product Experience — stitch existing screens into one coherent journey.
2. Core Workflow — persistent state transitions across Brand → Strategy → Plan → Content → Delivery.
3. Ads Engine — minimum internal paid-media campaign path.
4. Performance Intelligence — organic + paid evidence normalization and insight.
5. Agent Runtime — only the P5 capability required by H1.
6. Reliability — persistence, failure visibility, backup/recovery and demo repeatability.

Schema, canonical architecture, deployment and external mutations funnel through one mutation authority.

## 8. Implementation sequence

Sequence is outcome-driven rather than phase-driven:

### Slice A — Recover runnable baseline
- install/verify dependencies;
- seed a clean local database;
- run existing tests and build;
- launch the app and record current golden-journey breakpoints.

### Slice B — Connect existing product surfaces
- make Brand/BrandDNA the active context;
- connect Strategy → planning → Studio → Review → delivery state;
- remove dead navigation or state discontinuities that block the journey.

### Slice C — Add the minimum Ads Engine seam
- add paid campaign domain state only if no reusable model exists;
- bind campaign to Brand + Strategy/Goal + approved creative;
- expose audience, budget intent, status and metric provenance;
- keep live spend/external launch outside H1.

### Slice D — Close the performance-learning loop
- normalize organic and paid observations;
- produce evidence-linked insight;
- show how the insight changes or informs the next strategy decision.

### Slice E — Runtime demo hardening
- persistence across restart;
- explicit errors and degraded states;
- one repeatable demo seed/scenario;
- proportional tests around the golden journey.

## 9. H1 acceptance conditions

H1 is DONE only when all material conditions pass:

- [ ] App starts locally from documented commands.
- [ ] A user can create/select a Brand and persist Brand DNA.
- [ ] A Goal/Strategy can be created and remains linked to the active Brand.
- [ ] A content/campaign plan can produce at least one creative/content item.
- [ ] The item can pass a visible human review/approval state.
- [ ] Organic delivery state is demonstrable without hidden database edits.
- [ ] Paid/Ads path is demonstrable through campaign + audience + budget intent + creative + status.
- [ ] Performance evidence can be recorded for the demonstrated delivery path with provenance.
- [ ] Piltover produces an insight whose evidence is inspectable.
- [ ] The insight is visible in the next strategy/learning context.
- [ ] Data survives app restart.
- [ ] Failure/degraded states do not silently report PASS.
- [ ] Main journey has at least E3 runtime evidence.
- [ ] Relevant automated tests/build pass.
- [ ] No critical tenant/RBAC/approval invariant is bypassed.

## 10. Stop rule

When the H1 golden journey is runtime-demonstrable and the acceptance conditions have proportional evidence, declare H1 DONE and stop.

Do not continue into H2 reliability/integration work merely because it is adjacent.
