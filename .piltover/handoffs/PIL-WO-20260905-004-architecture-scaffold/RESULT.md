# P1 — ARCHITECTURE SCAFFOLD

STATUS: DONE

## BASE

Base commit: `342816cebb64cd2701931fba84c3d2e10bc6495a`

Implementation head: `4cd0122a853f611f59fea77b378ed861dddff47d`

Branch: `work/PIL-WO-20260905-004-architecture-scaffold`

origin/master at start: `342816cebb64cd2701931fba84c3d2e10bc6495a`

P0.2 reachable: YES

The approved fast-forward reconciliation moved only `origin/master` from `41e654e` to `342816c`.
Post-push verification proved all P0, P0.1, and P0.2 commits are ancestors; local canonical HEAD,
merge-base, and `origin/master` were identical; ahead/behind was `0/0`; and root canonical Markdown
was exactly `AGENTS.md`, `CLAUDE.md`, and `README.md`.

## CURRENT REPO OBSERVATIONS

Existing app structure: Next.js App Router pages, server actions, and API routes live under `app/`.

Existing lib structure: business behavior is distributed across `lib/auth`, `lib/strategy-engine`,
`lib/content-engine`, `lib/performance-engine`, `lib/facebook`, `lib/ai`, `lib/cloud-backup`, and
`lib/import-export`; Prisma enters through the root `lib/db.ts` and direct legacy type imports.

Existing test structure: Vitest discovers `tests/**/*.test.ts`; baseline had 21 files and 99 tests.

Existing provider edges: legacy code directly uses Prisma, Supabase, AI SDK provider adapters,
Facebook integration code, filesystem/crypto runtime utilities, and export libraries. These remain
unchanged compatibility inputs for later migration phases.

## SCAFFOLD DECISION

Chosen root/layout: `lib/piltover/modules` plus `lib/piltover/shared` inside the repository's existing
root `lib/` convention.

WHY: it creates one forward-looking, enforceable surface without moving legacy PBOS, adding another
source root, or changing the deployment unit. Tracked module roots use `.gitkeep`; implementation
layers are created only when future phases add real code.

Alternatives rejected: `src/`, npm packages/workspaces, a monorepo tool, twelve fake module APIs,
pre-created empty domain/application/infrastructure trees, and a new architecture dependency. Each
adds machinery or speculation without increasing P1 enforcement.

## FINAL ARCHITECTURE TREE

```text
lib/piltover/
|-- modules/
|   |-- identity/.gitkeep
|   |-- brands/.gitkeep
|   |-- evidence/.gitkeep
|   |-- content/.gitkeep
|   |-- work/.gitkeep
|   |-- approvals/.gitkeep
|   |-- agents/.gitkeep
|   |-- workers/.gitkeep
|   |-- learning/.gitkeep
|   |-- integrations/.gitkeep
|   |-- audit/.gitkeep
|   `-- platform/.gitkeep
`-- shared/
    |-- architecture/feature-flags.ts
    |-- contracts/error-envelope.ts
    `-- ports/core-ports.ts

tests/
|-- architecture/
|   |-- module-boundary-checker.ts
|   `-- module-boundaries.test.ts
`-- piltover/
    |-- error-envelope.test.ts
    `-- feature-flags.test.ts

docs/adr/
|-- README.md
`-- 0000-template.md
```

Future implemented module convention is `domain/`, `application/`, and `infrastructure/`. The
checker encodes the application-to-domain inward dependency direction for identifiable module
layer imports; no empty layer trees were manufactured.

## MODULES

identity: tracked root; no implementation or migration.

brands: tracked root; no implementation or migration.

evidence: tracked root; no implementation or migration.

content: tracked root; no implementation or migration.

work: tracked root; no implementation or migration.

approvals: tracked root; no implementation or migration.

agents: tracked root; no implementation or migration.

workers: tracked root; no implementation or migration.

learning: tracked root; no implementation or migration.

integrations: tracked root; no implementation or migration.

audit: tracked root; no implementation or migration.

platform: tracked root; no implementation or migration.

## PBOS → PILTOVER SEAM MAP

```text
lib/auth + current account/session actions
  -> identity

lib/strategy-engine + BrandDNA/audience/pillar behavior
  -> brands

uploaded sources + BrandDNA source provenance concepts
  -> evidence

lib/content-engine + ContentIdea/ContentDraft/Post behavior
  -> content

calendar/plan/task-like workflow concepts
  -> work

lib/performance-engine + MetricSnapshot/PerformanceInsight
  -> learning

lib/facebook
  -> integrations

lib/db.ts + Supabase/cloud-backup/storage primitives
  -> platform

lib/ai provider/run concepts
  -> future agents/workers/integrations seams

approval and durable audit concepts
  -> approvals/audit when their later phases define behavior
```

No migration performed.

## DEPENDENCY RULES

Implemented enforcement: a small test-only literal-import scanner classifies static imports,
re-exports, dynamic imports, and `require()` calls. Tests reject provider/framework imports from
future domain code and shared contracts/ports, reject domain-to-application/infrastructure and
application-to-infrastructure imports, prove an allowed application-to-domain import, verify all
module roots, and scan the actual `lib/piltover` tree.

Scope: only TypeScript/TSX files under the new `lib/piltover` surface. Legacy PBOS is intentionally
outside enforcement.

Known limitations: regex scanning does not resolve computed imports or semantic runtime coupling;
import-like text in comments can produce a reviewable false positive; JavaScript and nonstandard
TypeScript extensions are outside the current repository convention. Cross-module rules that need
real public surfaces remain deferred. The checker is intentionally small and replaceable by better
native tooling later.

## CORE PORTS

Canonical vocabulary: `AuthPort`, `UserDirectoryPort`, `OrganizationRepository`,
`BrandRepository`, `ContentRepository`, `TaskRepository`, `MetricRepository`, `AuditPort`,
`BlobStoragePort`, `JobQueuePort`, `WorkerRegistryPort`, `ApprovalPort`, `PublisherPort`,
`CodexRuntimePort`, `GitHostingPort`, `ClockPort`, `IdGeneratorPort`.

Concrete method-level contracts implemented: `ClockPort.now(): Date` and
`IdGeneratorPort.generate(): string`.

Deferred port method surfaces: all other vocabulary entries.

Reason for deferral: P1 has no stable immediate consumer semantics for their operations. Empty
interfaces or predicted CRUD/runtime APIs would provide no enforcement and would create false
contracts for P2–P10.

## SHARED CONTRACTS

ErrorEnvelope: `lib/piltover/shared/contracts/error-envelope.ts`

Feature flag primitive: `lib/piltover/shared/architecture/feature-flags.ts`

Other: NONE.

## ADR MECHANISM

location: `docs/adr/`

template: `docs/adr/0000-template.md`

ADRs created: NONE. P1 made no new consequential decision beyond already-approved canonical
architecture.

## FILES CHANGED

- `.piltover/handoffs/PIL-WO-20260905-004-architecture-scaffold/REQUEST.md`
- `.piltover/handoffs/PIL-WO-20260905-004-architecture-scaffold/CONTEXT.json`
- `.piltover/handoffs/PIL-WO-20260905-004-architecture-scaffold/STATUS.json`
- `.piltover/handoffs/PIL-WO-20260905-004-architecture-scaffold/RESULT.md`
- `.piltover/handoffs/PIL-WO-20260905-004-architecture-scaffold/REVIEW.md`
- `docs/adr/README.md`
- `docs/adr/0000-template.md`
- `lib/piltover/modules/identity/.gitkeep`
- `lib/piltover/modules/brands/.gitkeep`
- `lib/piltover/modules/evidence/.gitkeep`
- `lib/piltover/modules/content/.gitkeep`
- `lib/piltover/modules/work/.gitkeep`
- `lib/piltover/modules/approvals/.gitkeep`
- `lib/piltover/modules/agents/.gitkeep`
- `lib/piltover/modules/workers/.gitkeep`
- `lib/piltover/modules/learning/.gitkeep`
- `lib/piltover/modules/integrations/.gitkeep`
- `lib/piltover/modules/audit/.gitkeep`
- `lib/piltover/modules/platform/.gitkeep`
- `lib/piltover/shared/architecture/feature-flags.ts`
- `lib/piltover/shared/contracts/error-envelope.ts`
- `lib/piltover/shared/ports/core-ports.ts`
- `tests/architecture/module-boundary-checker.ts`
- `tests/architecture/module-boundaries.test.ts`
- `tests/piltover/error-envelope.test.ts`
- `tests/piltover/feature-flags.test.ts`

## DEPENDENCIES

Added: NONE.

Removed: NONE.

`package.json` and `package-lock.json` are unchanged.

## DATABASE

Schema changed: NO.

Migration created: NO.

## APPLICATION BEHAVIOR

Changed: NO.

No existing route, component, legacy business module, API payload, or persisted mutation was
modified or wired to the scaffold.

## VERIFICATION

BASELINE TEST:

command: `npm.cmd test`

result: PASS — 21 files, 99 tests, 0 failures.

BASELINE BUILD:

command: `npm.cmd run build`

result: PASS — Next.js production build completed; 20 static pages generated.

ARCHITECTURE TEST:

command: `npm.cmd test -- tests/architecture/module-boundaries.test.ts tests/piltover/error-envelope.test.ts tests/piltover/feature-flags.test.ts`

result: PASS — 3 files, 19 tests, 0 failures.

FULL TEST:

command: `npm.cmd test`

result: PASS — 24 files, 118 tests, 0 failures.

FINAL BUILD:

command: `npm.cmd run build`

result: PASS — Next.js production build completed; 20 static pages generated.

git diff --check:

result: PASS for `342816c..HEAD` before evidence closeout; no output.

Additional diagnostic: `npx.cmd tsc --noEmit` reports TS2352 at lines 105 and 140 of
`tests/ai/adapter-db-key.test.ts`. Both lines are unchanged from the P1 base and blame to commit
`481680f6`; no P1 file was reported. This pre-existing standalone-check limitation was not modified.

## REGRESSION COUNTS

Before:

- test files: 21
- tests: 99
- failures: 0

After:

- test files: 24
- tests: 118
- failures: 0

## SECURITY / SECRETS

result: PASS — no credential-shaped assignment in the P1 diff; no dependency, external service,
runtime egress, secret, or tracked generated output added. The supplied untracked technical-package
directory and ZIP remain unmodified and untracked.

## SCOPE AUDIT

P1-only: PASS.

Diff checks prove no change to `app/`, `components/`, `prisma/schema.prisma`, `prisma/migrations/`,
`package.json`, `package-lock.json`, root bootstrap Markdown, or legacy `lib/` modules.

## LIMITATIONS

- Boundary enforcement is lexical and forward-looking, not a full TypeScript dependency graph.
- Repository-wide standalone `tsc --noEmit` has the two pre-existing legacy test cast errors noted
  above; the required production build and full Vitest suite pass.
- P1 branch commits are local only; pushing, PR creation, and merge were not authorized.

## ACCEPTANCE

- PASS — P0, P0.1, and P0.2 prerequisites verified on canonical remote history.
- PASS — P1 branch is based on canonical P0.2 `master`.
- PASS — all canonical module roots exist.
- PASS — dependency direction is explicit and deterministically enforced on the new surface.
- PASS — domain/shared contracts and ports reject listed provider/framework imports.
- PASS — allowed, forbidden-provider, forbidden-layer, and actual-tree cases are tested.
- PASS — canonical core-port vocabulary exists.
- PASS — only stable Clock/ID methods are concrete; speculative surfaces are deferred.
- PASS — shared contracts have one canonical code location.
- PASS — ErrorEnvelope matches the canonical required/optional schema and error prefixes.
- PASS — feature-flag definition/resolution requires governance metadata and deterministic behavior.
- PASS — no future capability flag or fabricated owner is registered.
- PASS — ADR index/template follows the canonical trigger policy, fields, gates, and lifecycle.
- PASS — existing PBOS behavior is unchanged.
- PASS — baseline/full tests, targeted checks, final build, and diff check pass.
- PASS — no schema/migration, Organization, Workspace, Brand tenancy, or RBAC work occurred.
- PASS — no PBOS feature was moved or wired into the scaffold.
- PASS — no provider, VPS, Worker, Agent Control Plane, MCP, UI redesign, microservice, broker,
  monorepo, architecture framework, or dependency was introduced.
- PASS — handoff evidence is committed and contains the exact scope/verification record.
- PASS — final diff contains no unrelated cleanup.

## NEXT LEGAL PHASE

P2 — Data + Tenancy + RBAC, after Owner review/integration of P1.

DO NOT START P2.
