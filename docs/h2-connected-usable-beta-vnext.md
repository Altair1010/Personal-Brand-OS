# Horizon 2 — Connected Beta

Status: NEXT  
Rebased: 2026-09-22 after Horizon 1 closure and vNext implementation  
Objective stage: **DEMO → BETA**

## 0. Horizon objective

Horizon 1 proved that Piltover is a demonstrable Marketing OS with a real Agent execution boundary.

Horizon 2 must prove something different:

> A non-engineer beta operator can connect real provider accounts, operate real marketing workflows repeatedly, recover from ordinary failures, and obtain attributable live data without manual database repair or developer intervention.

H2 is not another architecture build. The following are already foundation and must be reused:

- persistent AgentThread / AgentRun / Checkpoint;
- OpenClaw worker execution, leases, retries, approvals and audit;
- Agent/Prompt/Skill version pinning;
- MarketingProjectContext;
- structured Strategy / IMC / Campaign / Content models;
- PublishingJob and provider-adapter seams;
- PerformanceSnapshot / Evidence / Experiment / Recommendation / EvaluationRun;
- ToolGrant default-deny policy;
- global Agent dock, command palette, realtime events and Command Center;
- multi-tenant organization/workspace/brand primitives;
- production build and additive migration discipline.

H2 therefore focuses on **real connectivity + real execution + real data + repeatable operator use**.

## 1. H2 success definition

A beta project can complete this lifecycle with real external systems:

```text
Connect provider
  ↓
Map account/page/channel → Brand
  ↓
Strategy / IMC / Campaign
  ↓
Content / Quality Gate
  ↓
Human approval
  ↓
Schedule PublishingJob
  ↓
Real provider publish
  ↓
Provider result / webhook / polling
  ↓
PerformanceSnapshot + Evidence
  ↓
Experiment / Recommendation
  ↓
Human review
```

and repeat it after:

- browser restart;
- backend restart;
- worker reconnect;
- credential refresh;
- provider rate limit;
- one ordinary provider failure.

## 2. H2 phase model

H2 uses five phases. Each phase closes a beta capability, not a component backlog.

---

# H2.1 — Connection Fabric & Provider Onboarding

Status: IMPLEMENTED / LIVE PROVIDER VALIDATION PENDING  
Acceptance record: `docs/h2.1-connection-fabric-acceptance.md`

## Objective

Make external accounts connectable and diagnosable from Piltover UI without editing environment files or touching the database.

## Scope

### A. Canonical ProviderConnection model

Provider-specific SDK/domain objects remain behind adapters.

Canonical connection state must cover:

```text
DISCONNECTED
CONNECTING
CONNECTED
DEGRADED
AUTH_EXPIRED
REAUTH_REQUIRED
REVOKED
ERROR
```

Minimum fields:

```yaml
ProviderConnection:
  id
  organization_id
  workspace_id
  brand_id
  provider
  account_ref
  resource_refs
  credential_ref
  scopes
  capabilities
  health
  last_verified_at
  last_error
  created_at
  updated_at
```

### B. Connection Center

Settings must provide:

- Connect;
- OAuth callback;
- account/page/resource discovery;
- map resource to Brand / Channel;
- connection health;
- refresh/reconnect;
- revoke/disconnect;
- scope/capability display;
- last sync / last error;
- actionable remediation.

No raw token is shown in normal UI.

### C. Social provider proof

H2 requires two live social provider implementations under the same adapter contract:

1. Meta family: Facebook/Instagram;
2. at least one non-Meta provider: LinkedIn, X or TikTok.

The second provider follows credential availability, but H2 cannot close with only Meta.

### D. Search/data connections

Connect the minimum production sources needed for current surfaces:

- Google Search Console or equivalent first-party search source;
- one SEO/SERP provider when credential access exists;
- AI visibility only when backed by a real source.

Unknown provider state remains explicit.

## Required evidence

- OAuth/connect/disconnect performed from UI;
- refresh/expiry/reconnect tested;
- same ProviderAdapter contract tests pass for both social providers;
- resource mapping is tenant/brand scoped;
- secret-redaction test proves no credential appears in logs, traces, artifacts or user-facing error payloads.

## H2.1 exit gates

1. Two live social provider adapters pass common contract tests.
2. Connection state survives app restart.
3. Expired credential becomes a recoverable UI state.
4. Resource discovery maps to the correct brand/account.
5. Revoked connection cannot perform new provider calls.
6. Provider capability differences are visible before execution.
7. No plaintext secret is exposed in standard logs/UI/artifacts.

---

# H2.2 — Durable Scheduling & Real External Execution

Status: IMPLEMENTED / LIVE EXTERNAL DELIVERY VALIDATION PENDING  
Acceptance record: `docs/h2.2-durable-publishing-acceptance.md`  
AMH evidence: `F:\tmp\evidence AMH v0.3\runs\2026-09\AMH-20260922-PILTOVER-H2-2`

## Objective

Turn PublishingJob from a correct internal abstraction into a reliable real-world delivery engine.

## Scope

### A. Durable scheduler

Scheduler must:

- execute jobs when due without browser presence;
- survive backend restart;
- survive worker reconnect;
- reclaim interrupted work safely;
- persist every attempt;
- maintain queue visibility;
- support manual retry.

Browser timers are never authoritative.

### B. Idempotent delivery

Every publish keeps:

```text
PublishingJob
provider payload snapshot
idempotency key
attempt history
provider request fingerprint
provider post ID
provider response
terminal state
```

Retry of the same job must never create duplicate external posts.

### C. Failure taxonomy

Normalize provider failures:

```text
RETRYABLE
RATE_LIMITED
AUTH_EXPIRED
VALIDATION_FAILED
PROVIDER_REJECTED
NETWORK
UNKNOWN
```

Support:

- Retry-After;
- exponential backoff;
- max attempts;
- blocked/dead state;
- operator remediation;
- manual retry after remediation.

### D. Approval-bound writes

External writes obey ToolGrant / ApprovalPolicy.

Approval binds to the exact provider payload fingerprint. If payload changes after approval, approval is invalidated and must be re-requested.

### E. Webhook / reconciliation

Where provider supports it:

- signature verification;
- event deduplication;
- webhook ingestion;
- polling fallback;
- provider-state reconciliation.

## Required evidence

Run live publish cases:

- immediate post;
- scheduled post;
- post after app restart;
- forced transient failure + retry;
- forced auth expiry;
- approval-gated publish;
- duplicate retry attempt.

## H2.2 exit gates

1. Scheduled real post executes with browser closed.
2. Restart before due time does not lose the job.
3. Retry cannot duplicate provider post.
4. Provider post ID and terminal state persist.
5. Rate-limit/auth-expiry produce recoverable states.
6. Approval pauses/resumes the same logical job.
7. Audit reconstructs request → approval → attempts → result.

---

# H2.3 — Live Data, Attribution & Search Intelligence

Status: IMPLEMENTED / LIVE DATA VALIDATION PENDING  
Acceptance record: `docs/h2.3-live-data-attribution-acceptance.md`  
AMH evidence: `F:\tmp\evidence AMH v0.3\runs\2026-09\AMH-20260922-PILTOVER-H2-3`

## Objective

Close the loop with real provider metrics and real search data while preserving deterministic provenance.

## Scope

### A. Live metrics ingestion

Normalize provider facts into:

```text
provider metric
  ↓
provider mapper
  ↓
MetricDefinition
PerformanceSnapshot
Evidence
```

Provider facts are deterministic data; LLM interpretation remains separate.

### B. Attribution continuity

Maintain lineage:

```text
StrategyVersion
→ IMCPlan
→ Campaign
→ ContentMaster
→ ChannelVariant
→ PublishingJob
→ Provider Post
→ PerformanceSnapshot
→ Evidence
→ Experiment
→ Recommendation
```

Unlinked imports remain explicitly unlinked. Never silently guess lineage.

### C. Search / SEO / GEO

Operationalize:

- Search Console ingestion;
- deterministic technical SEO audit;
- SERP/keyword research adapter where available;
- AIVisibilitySnapshot only from real providers.

### D. Data freshness

Expose:

- last successful sync;
- expected sync cadence;
- stale/degraded status;
- missing windows;
- import errors.

## Required evidence

- published provider item receives live metrics;
- metrics retain provider + account + post provenance;
- one Search Console/SEO dataset appears in canonical surfaces;
- stale/missing data is surfaced;
- one evidence-backed recommendation points to the actual PerformanceSnapshot/Evidence IDs.

## H2.3 exit gates

1. Real provider metrics reach canonical PerformanceSnapshot.
2. Published item is traceable back to strategy/campaign/content.
3. Search data is ingested with provenance.
4. Unlinked data is never silently attributed.
5. Recommendation can drill down to evidence.
6. Data freshness/error states are visible to operator.

---

# H2.4 — Multi-Brand Beta Governance, Recovery & Operator UX

## Objective

Prove the same system can safely operate multiple brands/accounts and that ordinary beta failures can be handled without engineering intervention.

## Scope

### A. Multi-brand / account isolation

Prove isolation for:

- provider connections;
- account/page resources;
- project context;
- AgentThread;
- attachments/artifacts;
- campaigns;
- drafts;
- approvals;
- metrics;
- evidence;
- recommendations;
- search and realtime streams.

### B. Bounded Agent operations

Beta policy:

- read-only connected tools can be broadly enabled;
- external writes are account/brand scoped;
- destructive/high-impact actions require approval;
- no autonomous budget mutation;
- no Agent bypass of ProviderAdapter or ToolGrant.

### C. Action history

Operator action log must answer:

```text
who
what actor/agent
which run/tool
which resource
payload fingerprint
approval
attempt/result
timestamp
trace
```

### D. Backup / clean restore

H2 needs a working beta-level recovery path for:

- local DB;
- artifact files/metadata;
- registry versions;
- safe application configuration;
- provider mapping metadata;
- connection metadata without raw secrets unless encrypted backup explicitly supports them.

Restore must be tested into a clean app data directory.

Historical external jobs must not replay after restore.

### E. Operator UX

Finish beta-critical surfaces:

- Connection Center;
- queue/scheduled jobs;
- approval inbox;
- failed-job recovery;
- sync/import status;
- account/brand switch clarity;
- backup/restore workflow;
- clear error/remediation states.

This is targeted operational UX, not a broad visual rewrite.

## H2.4 exit gates

1. Two brands with separate provider accounts operate without leakage.
2. Agent tool access fails outside brand/account scope.
3. One failed publish can be investigated end-to-end from UI/audit.
4. Backup → clean restore reproduces usable project state.
5. Restore does not replay external historical actions.
6. Common failures can be recovered without DB editing.
7. Operator can tell which brand/account every external action targets.

---

# H2.5 — Beta Closure & Soak

## Objective

Promote Piltover from demonstrable product to **usable beta**.

## Beta golden journey

At least one real project must complete:

```text
connect real provider
→ strategy
→ IMC/campaign
→ content
→ quality gate
→ human approval
→ schedule
→ real publish
→ ingest real metrics
→ evidence
→ recommendation
→ human review
```

Then repeat after a restart/reconnect event.

## Beta soak

Run a bounded soak covering:

- repeated scheduled jobs;
- credential refresh cycles;
- provider rate limits;
- worker reconnect;
- analytics imports;
- realtime events;
- at least two brands/accounts when available;
- backup + clean restore;
- no manual DB repair.

Every incident becomes a tracked beta defect with reproduction, severity and closure evidence.

## H2 DONE / BETA promotion gate

H2 is DONE only when all are PASS:

```text
two real social provider connections       PASS
real scheduled publishing                  PASS
idempotent retry                           PASS
provider result persistence                PASS
live metric ingestion                      PASS
search-data ingestion                      PASS
lineage / evidence continuity              PASS
multi-brand/account isolation              PASS
approval/audit continuity                  PASS
backup + clean restore                     PASS
operator recovery from common failures     PASS
bounded beta soak                          PASS
beta golden journey                        PASS
```

## H2 release label

When H2 closes:

```text
Product stage: BETA
Release channel: beta
Claim allowed: connected usable beta
Claim not allowed: production-grade / official stable
```

## H2 non-goals

- enterprise HA / multi-region;
- GA-grade installer/update/rollback;
- full compliance certification;
- autonomous budget/spend mutation;
- dozens of providers;
- automatic prompt rewriting from performance;
- MMM without data maturity;
- replacing Piltover control plane or OpenClaw architecture.
