# H1 Agent Boundary Audit

Status: CURRENT H1.4 AUDIT
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

## Remaining execution evidence

Code/contract boundary is compliant for Strategy, Marketing Intelligence, and Revision.

Full runtime proof still requires at least one real connected OAuth/OpenClaw worker to:
1. claim a Piltover Agent job,
2. execute through the declared route,
3. submit a structured result artifact,
4. have Piltover validate and persist that result.

Until that occurs, H1 Agent architecture is IMPLEMENTED but external Agent execution remains UNKNOWN, not PASS.
