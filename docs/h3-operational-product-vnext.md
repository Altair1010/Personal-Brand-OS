# Horizon 3 — Official Operational Product

Status: PLANNED AFTER H2 BETA  
Rebased: 2026-09-22  
Objective stage: **BETA → OFFICIAL**

## 0. Horizon objective

Horizon 3 is not a feature-expansion horizon.

H3 converts a connected beta into an **official, supportable, recoverable, secure and release-engineered product**.

The official product must be operable without the original developer machine or tribal knowledge.

A production operator must be able to answer:

```text
Is Piltover healthy?
What version is running?
What changed?
What failed?
What external action happened?
Are credentials safe?
Are tenants isolated?
Can I recover?
Can I upgrade?
Can I roll back or restore?
Can support diagnose this without editing the DB?
```

H3 preserves all H1/H2 architecture and closes operational risk.

## 1. H3 success definition

Piltover can be:

- installed/deployed from a versioned release artifact;
- upgraded from a supported prior release;
- recovered after crash/data failure;
- operated with explicit reliability targets;
- monitored and diagnosed;
- used with production tenant/security guarantees;
- supported through documented runbooks;
- promoted through development → beta → stable channels.

## 2. H3 phase model

H3 uses five phases.

---

# H3.1 — Reliability, Reconciliation & Recovery

## Objective

Turn beta reliability into measurable operational guarantees.

## Scope

### A. Baseline and SLOs

Measure before setting targets.

Track at minimum:

- API availability;
- scheduler lateness;
- queue depth/age;
- AgentRun completion latency;
- publish success rate;
- provider retry/error rate;
- analytics freshness;
- worker heartbeat freshness.

Then define internal SLOs from observed beta baseline.

### B. Reconciliation loops

Add idempotent reconciliation for:

- orphaned RUNNING Agent jobs;
- expired leases;
- PublishingJob/provider-state drift;
- stale approvals;
- stale OAuth/provider connections;
- missing analytics windows;
- incomplete artifact/evidence references;
- stuck scheduled jobs.

Every reconciliation action is auditable.

### C. Failure isolation

Partition work so one broken provider/account/brand cannot stall unrelated queues.

Introduce bounded concurrency and provider/account rate-limit buckets only where measurements show need.

### D. Production backup/recovery

Mature H2 backup into:

- scheduled backups;
- retention;
- integrity checks;
- encryption where needed;
- restore-version compatibility;
- tested restore runbook.

Define and test RPO/RTO appropriate to chosen deployment model.

### E. Migration safety

Every release migration requires:

- preflight;
- forward migration;
- compatibility expectation;
- data validation;
- realistic-copy rehearsal;
- rollback or restore plan.

## H3.1 exit gates

1. Crash/restart drills lose no accepted work and duplicate no external write.
2. Orphan/lease reconciliation is automatic.
3. Provider drift is detected and surfaced.
4. Restore drill meets documented RPO/RTO.
5. Migration rehearsal passes on realistic data.
6. One failing provider/account does not block unrelated scopes.
7. No critical recovery path requires ad-hoc SQL.

---

# H3.2 — Security, Tenant Isolation & Governance

## Objective

Make real customer/provider data and high-impact actions safe enough for official use.

## Scope

### A. Secret lifecycle

Centralize:

- secret references;
- encryption at rest where applicable;
- rotation;
- revocation;
- expiry;
- redaction;
- provider egress boundaries.

No secret appears in prompts unless explicitly required by policy.

### B. Least privilege

Harden authorization over:

```text
Organization
Workspace
Brand
Provider Account
Agent
Tool namespace
Action
Resource
read/write
approval requirement
rate limit
```

Default deny remains invariant.

### C. Tenant isolation suite

Automated isolation tests cover:

- APIs;
- server actions;
- Agent context;
- threads;
- attachments/artifacts;
- evidence;
- provider resources;
- search;
- realtime;
- exports;
- backups;
- diagnostics.

### D. Impact policy

Classify:

```text
read
low-risk internal write
external publish
destructive external mutation
budget/spend mutation
credential/security change
```

ApprovalPolicy is explicit and versioned.

### E. Audit / privacy / retention

Audit must reconstruct high-impact action without chain-of-thought.

Define executable retention/deletion for:

- chat;
- attachments;
- provider data;
- evidence;
- logs;
- backups.

Maintain ImportedPattern/license provenance for donor mechanisms.

## H3.2 exit gates

1. Tenant isolation passes across every external-facing data plane.
2. Standard DB/log/artifact/support exports contain no known plaintext secrets.
3. Revoked credential cannot call provider.
4. Unauthorized Agent/tool actions fail closed.
5. High-impact actions bind approval to exact executed payload.
6. Audit reconstructs external writes end-to-end.
7. Retention/deletion policy is executable and tested.

---

# H3.3 — Release Engineering, Deployment, Upgrade & Rollback

## Objective

Make Piltover deployable and upgradeable independently of the development checkout.

## Scope

### A. Distribution decision

Freeze the supported official deployment shape:

- desktop package, server/web artifact, or both;
- supported OS/runtime/database matrix;
- worker/OpenClaw compatibility expectations.

Do not keep official distribution ambiguous after this phase.

### B. Release artifact

Produce versioned artifacts containing:

- application version;
- migration version;
- worker protocol compatibility;
- event protocol version;
- Agent/runtime adapter compatibility;
- Prompt/Skill schema compatibility;
- build provenance.

### C. First-run preflight

Check:

- DB;
- schema/migrations;
- writable artifact directory;
- runtime dependencies;
- worker compatibility;
- provider configuration;
- backup directory/permissions.

Failures must show operator-readable remediation.

### D. Upgrade

Upgrade preserves:

- DB;
- artifacts;
- AgentThread/checkpoints;
- prompt/skill/agent registries;
- provider mappings;
- scheduled/pending work.

### E. Rollback

Two explicit modes:

1. app rollback when schema remains compatible;
2. restore-based rollback when schema/data migration is not reversible.

Do not market unsafe one-click rollback.

### F. Release channels

```text
development
beta
stable
```

Promotion is evidence-gated.

## H3.3 exit gates

1. Clean supported machine/environment installs/deploys from release artifact.
2. Upgrade from prior supported beta preserves state and pending work.
3. Failed upgrade has tested recovery.
4. Incompatible worker/protocol is rejected before execution.
5. Stable cannot promote with failed tests/evals/migrations.
6. Running version is exactly identifiable.
7. Reinstall/restore does not replay historical external jobs.

---

# H3.4 — Observability, Diagnostics & Production UX

## Objective

Make the system diagnosable and operationally comfortable for sustained use.

## Scope

### A. Unified trace model

Correlate:

```text
request
thread
AgentRun
job
tool call
approval
PublishingJob
provider request
analytics import
experiment
recommendation
```

through trace/correlation IDs.

### B. Operational metrics

Expose:

- queue depth/age;
- Agent latency/failure;
- publish success/failure;
- retry counts;
- approval wait;
- rate-limit events;
- analytics freshness;
- worker heartbeat;
- provider health;
- backup freshness;
- server/frontend errors;
- model token/cost only when upstream provides reliable usage.

### C. Structured logs

Require:

- timestamp;
- severity;
- subsystem;
- tenant-safe identifiers;
- trace ID;
- error class;
- redaction.

### D. Health & diagnostics center

Operator health view covers:

- DB/migrations;
- scheduler;
- worker/OpenClaw;
- provider connections;
- queue;
- realtime channel;
- analytics freshness;
- backup status;
- application version.

### E. Support bundle

Generate a redacted bundle containing enough state for diagnosis without raw secrets/private content by default.

### F. Production UX

Close:

- recovery messages;
- loading/empty states;
- action feedback;
- keyboard navigation;
- accessibility;
- responsive fallback;
- long-list performance;
- destructive confirmation;
- health/connection surfaces.

No broad visual redesign unless usability evidence requires it.

## H3.4 exit gates

1. One support bundle can diagnose a representative publish failure without DB access.
2. Health view identifies degraded provider/worker/scheduler states.
3. Trace links Agent/action/provider events end-to-end.
4. Accessibility smoke passes critical workflows.
5. Operational error messages provide remediation.
6. Redaction tests pass support bundle/logs.
7. Production UI remains functional under realistic long lists and degraded states.

---

# H3.5 — Release Candidate, Official Promotion & Operational Handoff

## Objective

Promote Piltover from Beta to **Official / Stable** only after sustained evidence.

## Release-candidate soak

Run sustained RC workload covering:

- scheduler;
- worker reconnect;
- provider refresh;
- publishing;
- retries;
- webhooks/polling;
- analytics;
- search ingestion;
- backup;
- restore sample;
- realtime;
- multiple brands/accounts;
- Agent threads/checkpoints;
- upgrade from previous beta build.

## Required quality gates

RC requires:

- production build;
- migration validation;
- critical state-machine tests;
- provider contract tests;
- live-provider smoke;
- tenant-isolation suite;
- security/redaction tests;
- accessibility smoke;
- eval-regression gates for production Agent/Prompt/Skill;
- backup/restore drill;
- upgrade/recovery drill;
- no unresolved blocker/critical incident.

## Official DONE gate

H3 is DONE only when Piltover is demonstrably:

```text
stable       → measured reliability + successful RC soak
secure       → tenant/secrets/tool-policy gates pass
recoverable  → backup/restore/crash/migration drills pass
upgradeable  → tested upgrade + rollback/restore path
observable   → metrics/log/trace/health surfaces work
deployable   → clean installation/deployment from release artifact
supportable  → redacted diagnostics + runbooks exist
usable       → production UX/accessibility gates pass
```

## H3 release label

When H3 closes:

```text
Product stage: OFFICIAL
Release channel: stable
Claim allowed: official operational product / stable release
```

## Operational handoff package

Official release requires:

- release notes;
- known limitations;
- deployment/install guide;
- provider setup guide;
- backup/restore runbook;
- incident/recovery runbook;
- upgrade/rollback guide;
- support bundle procedure;
- security/retention policy;
- compatibility matrix.

## H3 non-goals

- unlimited provider breadth;
- automatic high-budget media buying;
- marketplace as a release criterion;
- architecture replacement with LangGraph/CrewAI/Dify;
- automatic production prompt rewrites;
- MMM before data maturity;
- multi-region/enterprise HA unless product deployment strategy explicitly requires it.
