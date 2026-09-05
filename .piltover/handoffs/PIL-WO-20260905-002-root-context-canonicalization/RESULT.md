# P0.1 — ROOT CONTEXT BOOTSTRAP CANONICALIZATION

STATUS: DONE

## BEFORE

Root Markdown files: 11

| File | Tracked | Lines | Bytes | Consumer | Content class | Authority | Temporal class | Duplicate? | Action | Reason |
|---|---:|---:|---:|---|---|---|---|---|---|---|
| `AGENTS.md` | yes | 35 | 2,253 | Codex/agents | bootstrap/orchestration | competing legacy | semi-stable | yes | rewrite | Routes to deprecated root graph and mandatory PBOS sub-agents. |
| `CLAUDE.md` | yes | 211 | 11,895 | Claude Code | tool instruction/rules/spec/state | competing legacy | mixed | yes | rewrite | Independent PBOS constitution duplicated every root role. |
| `LOOP.md` | yes | 31 | 1,670 | legacy agents | execution loop | legacy | semi-stable | yes | remove | AMH/Work Order owns execution flow. |
| `MEMORY.md` | yes | 566 | 51,651 | legacy agents/hooks | memory/history/state | legacy | historical/mixed | yes | remove | Implementation history belongs to Git/code/tests; root append-only memory decays. |
| `plan.md` | yes | 21 | 653 | legacy agents | plan | legacy | volatile | yes | remove | Empty/stale EM2 plan; active work belongs to Work Orders. |
| `README.md` | yes | 46 | 2,380 | humans | human documentation | stale legacy | semi-stable | yes | rewrite | Described PBOS as current and omitted implemented extensions/Piltover direction. |
| `RULES.md` | yes | 138 | 10,128 | legacy agents | rules/specification | competing legacy | mixed | yes | remove | PBOS scope rules conflict internally and with Piltover authority. |
| `SPEC.md` | yes | 77 | 5,233 | legacy verifier | specification | superseded | semi-stable | yes | remove | Piltover package owns specifications; PBOS behavior is migration input. |
| `STATE.md` | yes | 54 | 3,780 | legacy agents | state/history | observational claim | volatile | yes | remove | Internally stale and redundant with Git/handoffs. |
| `todo.md` | yes | 23 | 1,285 | legacy agents | TODO/history | legacy | volatile | yes | remove | Completed EM2 checklist mislabeled active. |
| `ToFill.md` | yes | 87 | 11,244 | Owner/legacy runtime | TODO/operational input | legacy | volatile | yes | remove | Mixed obsolete and unresolved manual actions; unresolved value is recorded below. |

Context surface: 1,289 lines / 102,172 bytes.
Autoload/bootstrap surface (`AGENTS.md` + `CLAUDE.md`): 246 lines / 14,148 bytes.

## SEMANTIC HARVEST

### `LOOP.md`

CURRENT VALUE: smallest-change execution, verification, and stop behavior.
DESTINATION: compact AMH-compatible invariants in `AGENTS.md`; active steps in the Work Order.
ACTION: remove. Historical PBOS milestone loop remains recoverable from Git.

### `MEMORY.md`

CURRENT VALUE: PBOS implementation decisions and quirks for AI, persistence, Facebook, packaging,
versioning, attribution, and migrations.
DESTINATION: actual source/tests/migrations and Git history are empirical evidence; the canonical
migration package identifies PBOS assets/blockers. Unverified operational items are recorded below.
ACTION: remove. No historical implementation claim is promoted into Piltover bootstrap authority.

### `RULES.md`

CURRENT VALUE: safety, secret handling, surgical changes, review/attribution invariants.
DESTINATION: durable governance is covered by the Technical Constitution, Owner Gates, and minimal
`AGENTS.md` safeguards; implementation-specific behavior remains in code/tests and migration evidence.
ACTION: remove. Obsolete PBOS scope locks and duplicate process rules are not retained.

### `SPEC.md`

CURRENT VALUE: concise description of legacy PBOS behavior and acceptance.
DESTINATION: `11_MIGRATION/PBOS_TO_PILTOVER.md`, actual code/tests, and Git history.
ACTION: remove. It is migration input, not current Piltover specification.

### `STATE.md`

CURRENT VALUE: historical milestone outcomes plus unverified live-integration claims.
DESTINATION: P0 evidence, Git, runtime evidence, and the legacy migration gaps below.
ACTION: remove; it contained contradictory current-state statements.

### `plan.md` and `todo.md`

CURRENT VALUE: none as active state; EM2 work was already complete.
DESTINATION: Git history and P0 evidence.
ACTION: remove.

### `ToFill.md`

CURRENT VALUE: unresolved legacy live checks/configuration and release checks.
DESTINATION: legacy migration gaps below; future execution requires a scoped Work Order and fresh
evidence rather than carrying the checklist in autoload context.
ACTION: remove. Secrets themselves were not copied.

## FINAL ROOT CONTRACT

- `AGENTS.md`: shared Piltover identity, authority router, execution invariants, durable migration
  constraints, handoff workflow, and progressive canonical locators.
- `CLAUDE.md`: thin Claude-only adapter pointing one-way to `AGENTS.md`.
- `README.md`: human project entry, lineage/migration explanation, canonical documentation routing,
  verified repository commands, and durable boundaries.
- Other retained root Markdown: NONE.

## REMOVED

Root legacy containers: `LOOP.md`, `MEMORY.md`, `RULES.md`, `SPEC.md`, `STATE.md`, `plan.md`,
`todo.md`, `ToFill.md`.

For each: semantic harvest completed; no required runtime consumer remains; history is recoverable
through Git. Historical P0 evidence may still name these files as historical observations.

## BOOTSTRAP SCRIPT IMPACT

`setup-claude-agent-system.ps1`: REMOVED.

Reason: no package/CI/application consumer invoked it, and its foundation phase explicitly regenerated
all deprecated root files. Its tool/MCP setup responsibility was one-time environment scaffolding;
current checked-in configuration remains. Git provides recovery if that utility is ever needed.

Also retired because they could steer or recreate the PBOS context graph:

- `templates/idea-to-docs-master-prompt.md`
- `.claude/hooks/session-learner.ps1` and its active `SessionEnd` setting
- four `.claude/agents/pbos-*.md` definitions referenced only by legacy `AGENTS.md`

## FINAL CONTEXT GRAPH

```text
Owner
  ↓
Technical Constitution → Source of Truth
  ↓
active phase → approved Work Order → smallest relevant spec → relevant code → evidence
  ↑
AGENTS.md ← CLAUDE.md
  ↑
README.md (human entry)
```

The graph is one-way and acyclic. Root provides entry and routing, not a knowledge base.

## CONTEXT REDUCTION

BEFORE: 11 files / 1,289 lines / 102,172 bytes.

AFTER: 3 files / 176 lines / 7,010 bytes.

REDUCTION: 8 files / 1,113 lines / 95,162 bytes.

Autoload/bootstrap (`AGENTS.md` + `CLAUDE.md`) changed from 246 lines / 14,148 bytes to
91 lines / 3,730 bytes. Reduction is supporting evidence; the acceptance basis is the absence of
competing authority, stale state, and lost current requirements.

## VERIFICATION

- `git diff --cached --check`: PASS
- deleted-file references: PASS — zero active hits outside historical P0/P0.1 evidence and the
  canonical package
- canonical-path references: PASS — all introduced Markdown links and package locators resolve
- bootstrap cycle audit: PASS — `CLAUDE.md → AGENTS.md → canonical authority`; no reverse edge
- fresh Codex bootstrap: PASS — identity, authority, allowed behavior, and next-read route derivable
- fresh Claude bootstrap: PASS — routed to shared bootstrap, Work Order, package, and gates
- secret exposure: PASS — no high-confidence secret pattern in added lines
- scope audit: PASS — no schema, dependency, architecture, P1, or unrelated change
- modified JSON parse: PASS
- retired bootstrap recreation paths: PASS — no active consumer/reference remains

Full application test/build: intentionally skipped unless executable behavior changes beyond direct
messages/comments/bootstrap configuration. No application runtime artifact is intended to change.

## LEGACY MIGRATION GAPS

### GAP-1 — Live integration certification remains absent

- SOURCE FILE/SECTION: legacy `ToFill.md` §§3 and 5; `STATE.md` open live checks.
- SUMMARY: real AI flows, Supabase backup/restore, and Facebook Graph operation were not certified.
- WHY IT MAY MATTER: Piltover migration must not infer production readiness from mocks.
- CURRENT CODE EVIDENCE: `lib/ai/`, `lib/cloud-backup.ts`, `lib/facebook/`, and their tests.
- CANONICAL PACKAGE COVERAGE: explicitly listed as not live-verified in
  `00_META/SOURCE_OF_TRUTH.md`; Facebook/cloud assets are migration inputs.
- RECOMMENDED DISPOSITION: re-establish only in the future phase/Work Order that migrates each seam.

### GAP-2 — Legacy desktop release checks are unresolved

- SOURCE FILE/SECTION: legacy `ToFill.md` §4.
- SUMMARY: installer install/open and current DMG artifact behavior lacked fresh end-user evidence.
- WHY IT MAY MATTER: packaging knowledge is an asset, but historical artifact claims decay.
- CURRENT CODE EVIDENCE: `electron/`, `electron-builder.yml`, packaging scripts, and CI workflow.
- CANONICAL PACKAGE COVERAGE: `11_MIGRATION/PBOS_TO_PILTOVER.md` lists packaging knowledge as an
  asset; `SOURCE_OF_TRUTH.md` marks installer/DMG checks unverified.
- RECOMMENDED DISPOSITION: gate and re-test in a future release-specific Work Order.

### GAP-3 — Legacy Meta operational assumptions are not Piltover policy

- SOURCE FILE/SECTION: legacy `RULES.md` approved EM1 exception and `ToFill.md` §5.
- SUMMARY: the old claim that an own-page pasted token needs no review and its setup instructions may
  be provider-policy-sensitive.
- WHY IT MAY MATTER: later Meta adapter work must use then-current platform policy and permissions.
- CURRENT CODE EVIDENCE: `lib/facebook/`, Facebook tests, and migration history.
- CANONICAL PACKAGE COVERAGE: the migration package preserves Facebook work as an adapter seed but
  does not promote the old operational entitlement claim.
- RECOMMENDED DISPOSITION: validate against current official Meta requirements in the relevant phase;
  do not promote it into root bootstrap.

## FILES CHANGED

- `.claude/settings.json`
- `.piltover/handoffs/PIL-WO-20260905-002-root-context-canonicalization/CONTEXT.json`
- `.piltover/handoffs/PIL-WO-20260905-002-root-context-canonicalization/REQUEST.md`
- `.piltover/handoffs/PIL-WO-20260905-002-root-context-canonicalization/RESULT.md`
- `.piltover/handoffs/PIL-WO-20260905-002-root-context-canonicalization/REVIEW.md`
- `.piltover/handoffs/PIL-WO-20260905-002-root-context-canonicalization/STATUS.json`
- `.trellis/spec/backend/database-guidelines.md`
- `.trellis/spec/desktop/index.md`
- `.trellis/spec/desktop/packaging-contract.md`
- `AGENTS.md`
- `CLAUDE.md`
- `README.md`
- `app/api/upload/route.ts`
- `components/auth/AuthGate.tsx`
- `docs/milestones.md`
- `electron/main.js`
- `lib/cloud-backup.ts`
- `lib/stores/facebook.ts`
- `lib/stores/onboarding.ts`
- `lib/supabase-config.ts`
- `tokengain.ps1`

## FILES DELETED

- `.claude/agents/pbos-data-modeler.md`
- `.claude/agents/pbos-milestone-verifier.md`
- `.claude/agents/pbos-prompt-engineer.md`
- `.claude/agents/pbos-scope-guard.md`
- `.claude/hooks/session-learner.ps1`
- `LOOP.md`
- `MEMORY.md`
- `RULES.md`
- `SPEC.md`
- `STATE.md`
- `ToFill.md`
- `plan.md`
- `setup-claude-agent-system.ps1`
- `templates/idea-to-docs-master-prompt.md`
- `todo.md`

## APPLICATION CODE CHANGES

REFERENCE-ONLY CHANGES: comments were updated in `app/api/upload/route.ts`, `electron/main.js`,
`lib/cloud-backup.ts`, and two Zustand stores. Two existing Supabase configuration guidance strings
were updated in `components/auth/AuthGate.tsx` and `lib/supabase-config.ts` so they no longer point to
deleted `ToFill.md`. No control flow, data behavior, schema, dependency, product feature, or P1
architecture changed. This is required reference resolution, not a P0.1 scope violation.

## P0.1 ACCEPTANCE

| # | DONE criterion | Result |
|---:|---|---|
| 1 | P0 canonical baseline verified | PASS |
| 2 | Every actual root Markdown inventoried | PASS |
| 3 | Consumer/role/authority/temporality/disposition recorded | PASS |
| 4 | Semantic harvest before deletion | PASS |
| 5 | No unique current requirement/decision/constraint/instruction silently lost | PASS |
| 6 | No obsolete PBOS root rule can steer future Piltover work | PASS |
| 7 | No competing root rules/state/spec/plan/TODO/memory | PASS |
| 8 | `AGENTS.md` is canonical shared bootstrap | PASS |
| 9 | `CLAUDE.md` is a thin one-way adapter | PASS |
| 10 | `README.md` is the human Piltover entry | PASS |
| 11 | Volatile project state removed from root | PASS |
| 12 | Deep specs remain progressively loaded | PASS |
| 13 | Legacy bootstrap recreation behavior retired | PASS |
| 14 | Surviving references to deleted Markdown resolved | PASS |
| 15 | Introduced links/paths resolve | PASS |
| 16 | No product architecture/schema/UI feature/agent runtime/P1 implementation | PASS |
| 17 | Final diff is P0.1-relevant | PASS |
| 18 | P0.1 Work Order/Handoff evidence written | PASS |
| 19 | Root context entry substantially simpler | PASS |
| 20 | DONE means STOP | PASS |

## NEXT LEGAL PHASE

If P0.1 is DONE: P1 — Architecture Scaffold / Module Boundaries.

DO NOT START P1.
