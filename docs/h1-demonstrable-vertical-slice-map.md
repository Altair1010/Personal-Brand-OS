# H1 Demonstrable — Vertical Slice Map

Status: H1.0 baseline artifact
Branch: `work/H1-demonstrable-product-demo`
Baseline: `f641c740e17f8920b556416731fcbc4f1973fef0`

## Delivery rule
A local task counts as H1 product progress only when it either moves the golden journey forward or protects a material invariant required by H1.

## H1 golden journey
```text
Brand
  → Brand DNA / Goal
  → Strategy
  → Content Plan
  → Content
  → Approval
  → Scheduling / Publishing State
  → Organic + Paid Performance Metrics
  → Evidence-backed Insight
```

H1 requires a demonstrable local product journey. Build PASS alone is not H1 PASS.

## Observed reusable product capabilities
| H1 capability | Observed implementation | H1 disposition |
|---|---|---|
| Brand / workspace boundary | Prisma Workspace, Brand + P2 tenancy/RBAC | REUSE |
| Brand DNA / onboarding | BrandDNA, Goal, onboarding UI + AI route | REUSE / PATCH |
| Audience / pillars | UI, prompts, review gate | REUSE |
| Strategy | Strategy/Version, weekly/daily plans, strategy UI + AI | REUSE |
| Content planning | WeeklyPlan, DailyPlan, ContentIdea, Calendar | REUSE |
| Content creation | ContentDraft, writer/hook/CTA/tone routes | REUSE |
| Content approval | Draft approval + Post attribution; P3 approval primitives | REUSE / CONNECT |
| Performance | MetricSnapshot, PerformanceInsight, Performance Lab | REUSE / EXTEND |
| AI runtime | provider adapters + structured prompt runtime | REUSE |
| Durable control plane | P3 jobs/runs/approvals | REUSE selectively |
| Personal worker | P4 secure Worker/Codex bridge | REUSE selectively |
| Agent registry | P5 AgentDefinition/AgentRole registries | REUSE selectively |
## Missing H1 seams
| Seam | Why it blocks H1 | Minimum H1 solution |
|---|---|---|
| Unified vertical product spine | Existing modules are individually capable but not proven as one product journey | Connect existing state/data transitions end-to-end |
| Scheduling/publishing state | Calendar exists, but H1 needs explicit downstream delivery state | Minimal persisted schedule/publish state; no live provider required |
| Paid / Ads domain | Current MVP is organic/manual-performance centric | Add campaign/paid state and manual paid metrics seam |
| Organic + Paid performance convergence | Learning loop cannot compare both channels yet | Normalize H1 metrics into one evidence-backed performance view |
| Evidence-backed H1 insight | Legacy performance analysis exists, but Piltover H1 requires agent-routed execution plus provenance across the golden journey | Route analysis through Agent Control Plane and preserve metric/evidence pointers in returned insight |
| Product-level navigation/state continuity | Existing screens were built as PBOS modules | Make the H1 journey explicit and traversable |
| Minimal executable Agent seam | P5 has registries but no complete runtime binding | Add only if the H1 runtime needs agent execution; otherwise defer |

## Ads boundary for H1
Ads is part of the engine, not a detached feature.

```text
Strategy
   ├─ Organic → Content → Delivery ┐
   └─ Paid/Ads → Creative → State ├→ Performance → Insight → Learning → Strategy
                                  ┘
```

H1 does not require Meta Ads API, autonomous budget mutation, or real ad publishing. It must model paid campaign intent/state, accept paid performance evidence, and feed that evidence into learning without pretending an external campaign ran.

## AMH v0.3 controls
- Minimum sufficient graph: implement only seams required for the H1 journey.
- One active mutation route: the H1 branch is the integration authority.
- Evidence before transition: each H1 gate needs claim-matched evidence.
- Unknown is not PASS: external integrations remain explicit unconnected states.
- Sequential verification: stop testing when evidence is sufficient for the claim/risk.
- DONE means stop: H1 completion does not authorize H2.
## H1 phase sequence
1. H1.0 — Baseline Cut & Golden Path Harness.
2. H1.1 — Product Spine: state/data journey end-to-end.
3. H1.2 — Demonstrable Experience: local UI journey.
4. H1.3 — Agent Runtime + Intelligence Loop: Agent Control Plane, Organic + Ads evidence, learning.
5. H1.4 — Runtime Proof & H1 closure.

## Explicit non-goals before H1
- Completing P5 merely because P5 is unfinished.
- Full Permission Compiler / Context Compiler unless the golden journey proves they are required.
- P6 tool platform completeness.
- Skill marketplace or licensing.
- Live Meta Ads campaign creation or budget mutation.
- Multi-platform publishing breadth.
- Production-grade visual polish.
- H2 reliability, installer/update/rollback completeness.

## Baseline verification note
The latest P5 handoff records a prior successful full suite (276 passed, 1 live test skipped), production build, and Prisma validation at P5-G2. During H1.0, fresh full-suite and production-build attempts were started but stalled without verdict in the local Windows/Prisma environment and were terminated rather than fabricated as PASS.

Therefore H1.0 treats the historical P5 verification as historical evidence only. Fresh verification remains required when H1.1 introduces product mutation.

## H1.0 verdict
The repository already contains most of the organic golden-path primitives. H1 should primarily be an integration/productization effort plus the missing Paid/Ads and performance seams, not a greenfield rewrite.

## H1.0 addendum — Meta Ads seam freeze
Meta Ads is now an H1 engine seam, not a later detached feature.

H1 projection:
```text
MarketingCampaign
  ├─ Organic → Post → ContentDelivery
  └─ Paid → MetaAdsCampaign
               ├─ targeting + budget = Ad Set projection
               ├─ creativePostId = Creative/Ad projection
               └─ MetaAdsMetricSnapshot = paid evidence
```

This is intentionally not a full mirror of Meta's provider object graph. H1 needs a stable internal campaign spine, explicit external-connection state, manual/provider-ready metrics, and evidence convergence. Full provider synchronization remains outside H1.

Meta Ads H1 states:
`DRAFT → READY → EXTERNAL_NOT_CONNECTED | SYNCED → PAUSED | COMPLETED`.

No H1 code may represent `EXTERNAL_NOT_CONNECTED` as a successful live campaign.

## H1.2 closure — Demonstrable Experience

The H1 product spine is now exposed through a navigable local UI:

```text
Dashboard
  → Onboarding / Brand DNA
  → Strategy
  → Studio / Approval
  → Campaigns
      ├─ Organic scheduling
      └─ Meta Ads seam + manual paid evidence
  → Performance
      ├─ Organic metrics
      └─ Meta Ads performance
  → Insight
```

Meta Ads remains truth-preserving: the UI shows `EXTERNAL_NOT_CONNECTED` until a real provider integration exists.

## H1.3 implementation — Agent Runtime + Intelligence Loop

Piltover does not treat model APIs as the product AI runtime. Every AI/bot capability is an Agent capability and is dispatched through the Agent Control Plane.

```text
Organic evidence ───────┐
                        ├─→ Marketing Intelligence Agent Intent
Paid / Meta evidence ───┘                │
                                         ▼
                               Agent Execution Gateway
                                  ┌──────┴──────┐
                                  ▼             ▼
                                OAuth        OpenClaw
                                                │
                                      ┌─────────┴─────────┐
                                      ▼                   ▼
                                   Termius             9router
                                  (support)            (support)
                                                │
                                                ▼
                                      controlled Agent runtime
                                                │
                                                ▼
                                  structured result artifact
                                                │
                                     evidence-ref validation
                                                │
                                                ▼
                                      PerformanceInsight
                                                │
                                                ▼
                                          Review / Revision
                                                │
                                                ▼
                                          Next Strategy
```

Execution invariants:
- `AI capability != model provider`.
- Product-domain code does not call OpenAI/Anthropic/model APIs for Piltover Agent execution.
- OAuth and OpenClaw are the two Agent execution routes.
- OpenClaw is the agent controller/runtime route; Termius and 9router are supporting connectivity/routing layers under OpenClaw, not peer AI providers.
- Agent results enter Piltover through the control-plane result artifact contract and must pass evidence-reference validation before persistence.
- Legacy PBOS direct-model code may remain for compatibility but is not canonical H1 execution architecture.

Current local evidence:
- Agent gateway and result-ingestion contracts are implemented and tested.
- No Worker is currently registered in the local control plane, so live OpenClaw/OAuth execution remains unverified.
- 9router is present locally; OpenClaw/Termius CLI presence was not established. This is not treated as proof that the OpenClaw runtime is connected.

### H1 Agent-boundary closure rule
The repository still contains legacy PBOS direct-model routes. They are compatibility debt, not Piltover architecture.

H1 final closure requires a golden-journey audit proving that every AI/bot action used by the canonical demo is routed through AgentExecutionGateway → OAuth/OpenClaw. A legacy direct-model path may remain in the repository only if the H1 demo does not depend on it.

## H1.4 — Agent Boundary Audit + Runtime Proof

Agent-boundary audit completed.

Canonical H1 execution now follows:

```text
Brand / Goal ------------------------- deterministic
Audience / Pillars ------------------- deterministic
Strategy ----------------------------- Strategy Agent
Content draft / approval ------------- deterministic + human
Campaign / Organic / Paid evidence --- deterministic
Performance aggregation -------------- deterministic
Marketing Intelligence --------------- Marketing Intelligence Agent
Review / Revision -------------------- Revision Agent
Apply revision ----------------------- human
```

All AI/bot actions used by the canonical H1 demo are required to route through:
`AgentExecutionGateway -> Agent Control Plane -> OAuth/OpenClaw`.

Optional PBOS direct-model helpers remain legacy and are excluded from H1 acceptance.

Fresh runtime proof:
- H1 targeted tests: 31/31 PASS.
- Prisma validate: PASS.
- 8/8 canonical H1 web routes: HTTP 200.
- Canonical Strategy/Performance/Review direct-model grep: zero matches.

External Agent proof is still blocked:
- OpenClaw Tray is installed/running.
- configured gateway: `ws://127.0.0.1:18789`.
- TCP connection to 127.0.0.1:18789 currently fails.
- OpenClaw diagnostics show repeated connection errors.
- Piltover has zero registered workers.

Therefore H1.4 is implemented, but H1 closure remains `BLOCKED_BY_LIVE_AGENT_GATEWAY`. No H1 DONE claim is made.
