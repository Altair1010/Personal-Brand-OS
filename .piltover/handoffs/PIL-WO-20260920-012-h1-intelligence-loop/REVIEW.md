# H1.3 Review — Corrected

## Architecture fit
PASS WITH LIVE-EXECUTION CONDITION.

The corrected path reuses P3 jobs/runs/worker leases, P4 worker transport primitives and P5 agent semantics instead of embedding a model SDK inside the marketing domain.

## Authority model
- Agent capability does not imply mutation permission.
- OAuth/OpenClaw are execution routes, not business authority.
- OpenClaw can create/control agents, but jobs remain bounded by Piltover scope, capabilities, leases and approval gates.
- Termius and 9router support OpenClaw connectivity/routing only; neither becomes an execution authority on its own.

## Evidence integrity
PASS for contract path. Structured result artifacts must validate and all evidence refs must resolve to evidence originally supplied to the run before PerformanceInsight is written.

## Compatibility
Legacy PBOS direct-provider code remains in the repository for historical/compatibility paths, but H1.3 no longer imports or depends on it.

## Remaining blocker
A live Agent worker using OpenClaw or OAuth must be registered and execute one bounded Marketing Intelligence run before H1.3 can be marked fully VERIFIED.

## Gate
H1.3 = IMPLEMENTED / BLOCKED_BY_LIVE_AGENT_EVIDENCE.
H1.4 must not claim H1 DONE until this live execution gap is closed or explicitly accepted by the Owner.

## Cross-H1 legacy debt discovered during correction
Legacy PBOS routes still exist under `app/api/ai/*`, plus direct `runModule` use in Strategy/Review. They are not canonical Piltover Agent execution and are not silently reclassified as compliant.

This correction removes direct-model execution from the H1.3 Marketing Intelligence path only. Before H1 final closure, any golden-journey step that still depends on those legacy direct-model paths must either:
1. be migrated behind AgentExecutionGateway, or
2. be explicitly excluded from the H1 canonical demo path.

Therefore H1.4 must include an Agent-boundary audit across the complete golden journey.
