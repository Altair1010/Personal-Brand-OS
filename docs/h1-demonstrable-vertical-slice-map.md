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
| Evidence-backed H1 insight | Performance AI exists, but H1 needs provenance across the golden journey | Preserve metric/evidence pointers in generated insight |
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
4. H1.3 — Runtime + Intelligence Loop: AI, organic + Ads performance, evidence.
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
