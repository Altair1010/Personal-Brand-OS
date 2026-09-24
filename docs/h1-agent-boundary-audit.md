# H1 Agent Boundary Audit

Status: CLOSED — H1 live Agent runtime proof freshly re-passed 2026-09-22
Branch: `work/H1-demonstrable-product-demo`
Canonical rule: every AI/bot capability used by the H1 demo executes through `AgentExecutionGateway -> Agent Control Plane -> OAuth/OpenClaw`.

## Audit scope

Canonical H1 journey:

```text
Brand / Goal
  -> Audience / Pillars
  -> Strategy
  -> Content Draft
  -> Approval
  -> Campaign
      -> Organic delivery
      -> Meta Ads seam
  -> Performance
  -> Marketing Intelligence
  -> Review / Revision
  -> Next Strategy
```

## Boundary matrix

| H1 step | Canonical H1 action | AI/bot required? | Execution boundary | Audit |
|---|---|---:|---|---|
| Brand / Goal | Manual form + server persistence | No | deterministic server action | PASS |
| Audience / Pillars | Manual persona/pillar editing + approval | No | deterministic server action | PASS |
| Strategy | Strategy Agent dispatch + artifact sync | Yes | AgentExecutionGateway -> OAuth/OpenClaw | PASS_CONTRACT |
| Content Draft | Blank/idea draft + manual editor | No | deterministic server action | PASS |
| Content AI helpers | post-writer/hook/CTA/tone | Optional, excluded from canonical H1 demo | legacy `/api/ai/*` direct-model path | EXCLUDED_LEGACY |
| Approval | Human approval | No | deterministic server action | PASS |
| Campaign | Campaign/domain persistence | No | deterministic server action | PASS |
| Organic scheduling | Human schedule action | No | deterministic server action | PASS |
| Meta Ads seam | Internal state + manual evidence | No live agent required in H1 | deterministic server action | PASS |
| Performance metrics | Deterministic aggregation | No | local performance engine | PASS |
| Marketing Intelligence | Marketing Intelligence Agent | Yes | AgentExecutionGateway -> OAuth/OpenClaw | PASS_CONTRACT |
| Review / Revision | Revision Agent dispatch + artifact sync; human apply | Yes | AgentExecutionGateway -> OAuth/OpenClaw | PASS_CONTRACT |
| Next Strategy | Human applies validated revision | No autonomous mutation | approval/human action | PASS |

## Legacy direct-model debt

The repository still contains PBOS compatibility paths that call `runModule()` or `/api/ai/*` directly. They are not Piltover Agent architecture.

Observed legacy surfaces include:
- `app/api/ai/{brand-dna,audience,pillars,strategy,weekly-plan,post-writer,hook,cta,tone,performance,revision}`
- optional AI buttons in Brand/Audience/Content legacy UI.

H1 closure rule: these paths may remain only when the canonical H1 demo does not invoke them. They must not be represented as Piltover Agent-compliant.

## H1 canonical demo constraint

For H1:
- Brand DNA is entered manually.
- Personas/pillars are entered/edited manually and approved.
- Strategy is created by Strategy Agent through Agent Control Plane.
- Content can be created/edited manually.
- Marketing Intelligence is Agent-routed.
- Strategy Revision is Agent-routed, then explicitly applied by the human.
- Optional legacy AI helper buttons are outside the H1 acceptance path.

## Final execution evidence

Code/contract boundary remains compliant for Strategy, Marketing Intelligence, and Revision.

The previously missing live runtime proof has now been completed with a real connected OpenClaw worker.

Observed canonical proof, refreshed 2026-09-22:

1. Control-plane health returned OK with one registered/enabled/fresh worker.
2. Piltover dispatched `agent-run-a81114a5ba9762f2e8910da7fb8e2d69` / `agent-job-a81114a5ba9762f2e8910da7fb8e2d69` as `role:strategy-planner@h1`, pinned to `builtin:strategy-planner:v1`, PromptVersion `b3d493c8-1123-490b-a581-7b5fdafe0510`, and SkillVersion `c816aaf4-3e69-479a-b90a-0df3913811ad`.
3. `worker-openclaw-local` claimed the exact Piltover job under the current brand grant and the run reached `RUNNING -> COMPLETED`.
4. OpenClaw returned the required `strategy-plan-result` structured artifact; Piltover validated weekly day counts `7,7,7,7,2`.
5. Runtime metadata persisted on AgentRun: `vllm:COMBO_VIP`, response model `gpt-5.6-sol`, 27,860 total tokens.
6. Piltover validated the StrategyPlanResult/v2 contract and persisted StrategyVersion `cmuceikae00017kmsswp8dsve` with exact `sourceAgentRunId`.
7. Structured `piltover.marketing-strategy/v1` and IMC projection `146ec814-d3a6-4e29-b6ea-42fb50e45b24` were persisted.
8. Terminal audit entry `26b3efa6-d588-487d-a47c-a2ebed1a7699` records `AGENT_RUN_TERMINAL`.
9. Fresh closure verification: 26/26 H1 targeted tests PASS, TypeScript PASS, Prisma validate PASS, 22 migrations up to date, 8/8 canonical routes HTTP 200, production build PASS.

The live external Agent execution boundary is therefore PASS for H1.

Optional legacy PBOS direct-model helpers remain compatibility debt and remain outside the canonical H1 acceptance path.
