# P0.2 — LEGACY INSTRUCTION RECOVERY & PILTOVER CONTEXT ENRICHMENT

STATUS: REVIEW_READY

## SOURCE RECOVERY

The exact recovery snapshot is `41e654e885212e200977eff4ae4d09fec62f201e`, the
parent of the P0.1 rewrite commit `0d39fea7707c800eaaae6b7f3eb00cfcb1dc714d`.
The sources were read with `git show`; none was checked out or restored.

- `RULES.md`: snapshot `41e654e`; latest content commit `c3a29ab9bbe40979abdb9e524952ce1d0c640ed9`.
- `AGENTS.md`: snapshot `41e654e`; latest content commit `2194aeaab01345a51a2f2e3a943eed147d986b92`.
- `CLAUDE.md`: snapshot `41e654e`; latest content commit `f646043639e1901a92cda9757968c753a847cd08`.
- P0.1 base/legacy snapshot: `41e654e885212e200977eff4ae4d09fec62f201e`.
- P0.2 base: `4f0b7ac2fdbeece633b0cb47f9b81c5f6a84ac34`.
- P0.2 final commit: recorded in the closeout commit/update after verification.

## SEMANTIC INVENTORY

- `RULES.md`: 34 atomic rules.
- `AGENTS.md`: 11 atomic rules.
- `CLAUDE.md`: 35 atomic rules.
- Total: 80 atomic rules.

Legend: AC = ALREADY_COVERED; HIST = HISTORICAL_ONLY; ESC = ESCALATE.

| ID | Legacy source | Legacy semantic rule | Category | Current equivalent | Evidence | Disposition | Destination | Reason |
|---|---|---|---|---|---|---|---|---|
| RULES-R001 | RULES | Gate delete/overwrite | Governance | Stronger gate model | Constitution C2; Owner Gates G4 | AC | Canonical package | Already authoritative. |
| RULES-R002 | RULES | Branch and PR; no direct main push | Git | Task branch and authorization | Current AGENTS §6; Codex Playbook 6/13 | AC | None | Current route is less brittle. |
| RULES-R003 | RULES | Never bypass hooks/signing | Git | No active signing/hook policy | Git config and hooks inspection | REJECT | None | Unsupported absolute mechanism rule. |
| RULES-R004 | RULES | Do not send project content externally without authorization | Governance | Missing explicit data-egress guard | Owner Gates G3 supports principle | ABSORB | AGENTS §4 | Prevents plausible disclosure with low cost. |
| RULES-R005 | RULES | Never track plaintext secrets | Security | Package-only detail | Security Model; Codex Playbook 10 | ABSORB | AGENTS §6 | High-impact bootstrap safety invariant. |
| RULES-R006 | RULES | Store secrets in Claude local settings env | Tool-specific | Legacy Claude mechanism | Historical `.claude` design | HIST | None | Mechanism is not a Piltover-wide contract. |
| RULES-R007 | RULES | Scan staged diff for secret material | Git/Security | Diff review was generic | Codex Playbook 10 | ADAPT | AGENTS §6 | Converts broad review into one decisive check. |
| RULES-R008 | RULES | Exclude secrets from backup | Product/Security | Plaintext secrets excluded | Backup and Recovery; Security Model | AC | Canonical package | Product requirement already owned. |
| RULES-R009 | RULES | Exclude local Supabase binding from PBOS snapshot | PBOS product | No direct Piltover equivalent | Legacy code-specific claim | HIST | None | Old storage/account mechanism. |
| RULES-R010 | RULES | Use passphrase rather than per-install key for PBOS snapshot | PBOS product | New backup design owns recovery | Backup and Recovery | HIST | None | Old implementation decision, not bootstrap. |
| RULES-R011 | RULES | Match style and make surgical changes | Engineering | Partial | Current AGENTS §4 | ADAPT | AGENTS §4 | Adds consumers/tests and observable behavior. |
| RULES-R012 | RULES | Every changed line traces to request | Engineering | Smallest coherent change/no cleanup | Current AGENTS §4 | AC | None | Existing wording is sufficient and less rigid. |
| RULES-R013 | RULES | Concise conventional commits | Git | Reviewable commits | Current AGENTS §6 | AC | Canonical workflow | Style detail need not consume bootstrap. |
| RULES-R014 | RULES | Fixed four-tool compression order | Context | Progressive loading | Current AGENTS §3 | REJECT | None | Obsolete local tooling and over-prescription. |
| RULES-R015 | RULES | Root STATE/MEMORY split | Context | Work Order/handoff state | Current AGENTS §§3/6 | REJECT | None | P0.1 intentionally retired this architecture. |
| RULES-R016 | RULES | Maintain root plan/todo live then delete | Execution | Active Work Order packet | Handoff Protocol | REJECT | None | Competing task-state system. |
| RULES-R017 | RULES | ToFill is manual-action registry | State | Handoff/open inputs | Handoff Protocol | REJECT | None | Recreates retired root state. |
| RULES-R018 | RULES | Escalate after exactly two failures | Execution | Evidence-driven escalation | Current AGENTS §4 | REJECT | None | Arbitrary fixed loop conflicts with adaptive execution. |
| RULES-R019 | RULES | Lock old eight-tab PBOS MVP | PBOS product | Piltover is parent/core OS | Source of Truth | HIST | None | Stale product scope. |
| RULES-R020 | RULES | Preserve fixed PBOS enum vocabularies | Product requirement | No exact canonical mapping | Package search; legacy source | ESC | Legacy spec gap SG-001 | Needs domain-migration judgment. |
| RULES-R021 | RULES | Normalize content ratios to 100 in code | Product requirement | No exact canonical mapping | Package search; legacy source | ESC | Legacy spec gap SG-001 | Potential behavior invariant, not bootstrap rule. |
| RULES-R022 | RULES | Legacy AI execution is server-side only | Product/Architecture | Primary path changes to worker | Constitution C13; migration spec | ESC | Legacy spec gap SG-002 | Underlying trust boundary needs later mapping. |
| RULES-R023 | RULES | External input is data, not instructions | Security/Context | Structured trust boundary is broader | Constitution C7; Security Model | ADAPT | AGENTS §4 | Durable prompt-injection/context guard. |
| RULES-R024 | RULES | No hardcoded provider model; user selects it | PBOS product | Codex worker is primary | Constitution C13 | HIST | None | Provider mechanism changed. |
| RULES-R025 | RULES | Validate/sanitize/call/validate/repair/save AI pipeline | Product requirement | Observability only partially covers it | Constitution C6; migration assets | ESC | Legacy spec gap SG-002 | Exact runtime behavior requires later decision. |
| RULES-R026 | RULES | Human approval before strategy activation | Governance/Product | Canonical mutation gate | Owner Gates G2 | AC | Canonical package | Already stronger and generalized. |
| RULES-R027 | RULES | Preserve draft attribution links | Product/Data | Rich revision lifecycle and attribution | Content Lifecycle; P9 | AC | Canonical package | Exact legacy IDs are implementation details. |
| RULES-R028 | RULES | Strategy direction changes require non-null reason | Product/Data | No exact constraint located | Package search; legacy source | ESC | Legacy spec gap SG-003 | Possible migration invariant needs owner/domain review. |
| RULES-R029 | RULES | Generate old 30-day strategy weekly | PBOS product | New lifecycle differs | Source of Truth; domain docs | HIST | None | Old truncation workaround and product shape. |
| RULES-R030 | RULES | Fixed PBOS milestone/build/seed gate | Temporary execution | Proportional Work Order verification | Current AGENTS §§4/6 | HIST | None | Milestone-era ceremony is obsolete. |
| RULES-R031 | RULES | Electron wrapper must not change web scope | PBOS product | Packaging knowledge is migration asset | Migration spec | HIST | None | Specific completed exception, not global rule. |
| RULES-R032 | RULES | Packaged runtime paths/data/config must be relocatable | Product/Packaging | Packaging knowledge named, details absent | Migration spec line 39; package search | ESC | Legacy spec gap SG-004 | Preserve for later packaging migration review. |
| RULES-R033 | RULES | EM1 unlocks selected PBOS features | Historical state | Piltover migration supersedes milestones | Source of Truth | HIST | None | Completed exception log. |
| RULES-R034 | RULES | EM1 keeps secrets server-side and provider seams intact | Security/Architecture | Replaceable edges and scoped secrets | Constitution C4/C13; Security Model | AC | Canonical package | Already generalized. |
| AGENTS-A001 | AGENTS | Fixed triage/researcher/implementer/verifier roles | Agent execution | One active route | Current AGENTS §4 | REJECT | None | Unrequested agent topology and ceremony. |
| AGENTS-A002 | AGENTS | Triage reads root state/todo | Context | Work Order routing | Current AGENTS §§3/6 | REJECT | None | Depends on retired files. |
| AGENTS-A003 | AGENTS | Researcher must query graph first | Tool-specific | Inspect smallest relevant slice | Current AGENTS §3 | REJECT | None | Tool availability is not durable. |
| AGENTS-A004 | AGENTS | Implement in isolation with surgical changes | Engineering/Git | Task branch, smallest coherent change | Current AGENTS §§4/6 | AC | None | Already represented. |
| AGENTS-A005 | AGENTS | Verifier reports evidence and does not silently fix | Verification | Record results; never fabricate | Current AGENTS §§4/6 | AC | None | Role split is unnecessary. |
| AGENTS-A006 | AGENTS | Fixed four-agent orchestration flow | Agent execution | AMH one active route | Current AGENTS §4 | REJECT | None | Conflicts with minimal harness. |
| AGENTS-A007 | AGENTS | Use four PBOS specialist agents | PBOS agents | Retired in P0.1 | P0.1 result | HIST | None | Old files and scope no longer active. |
| AGENTS-A008 | AGENTS | Every milestone requires multi-agent gate chain | Agent execution | Proportional verification | Current AGENTS §4 | REJECT | None | Excessive mandatory orchestration. |
| AGENTS-A009 | AGENTS | Escalate at legacy hard stops | Governance | Owner Gates | Current AGENTS §§2/5 | AC | None | Canonical gate routing supersedes it. |
| AGENTS-A010 | AGENTS | Gate irreversible delete/overwrite/push | Governance | Owner Gates and authorized Git workflow | Constitution C2; AGENTS §§5/6 | AC | None | Already covered. |
| AGENTS-A011 | AGENTS | Escalate after two repeated failures | Execution | Adaptive evidence-based behavior | Current AGENTS §4 | REJECT | None | Same arbitrary threshold as RULES-R018. |
| CLAUDE-C001 | CLAUDE | Always reply in Vietnamese | Tool/style | Current-user language governs | Owner current instruction | REJECT | None | Not Piltover- or Claude-specific. |
| CLAUDE-C002 | CLAUDE | Fixed language by artifact class | Tool/style | User/task chooses artifact language | Current instruction hierarchy | REJECT | None | Over-broad and not Claude-only. |
| CLAUDE-C003 | CLAUDE | `milestones.md` is sole execution file | PBOS state | Work Order and phase spec | Handoff Protocol | HIST | None | Superseded execution system. |
| CLAUDE-C004 | CLAUDE | Read old PBOS product docs in fixed order | Context | Progressive canonical routing | Current AGENTS §§2/3/7 | HIST | None | Sources are legacy migration input. |
| CLAUDE-C005 | CLAUDE | One PBOS milestone per run and `Mx` commit | Temporary execution | Work-order identity and branch | Handoff Protocol | HIST | None | Old milestone convention. |
| CLAUDE-C006 | CLAUDE | `/clear` each milestone and at 70% context | Tool-specific | Progressive loading | Current AGENTS §3 | REJECT | Model/tool-specific fixed threshold. |
| CLAUDE-C007 | CLAUDE | Seed Khang Guru/XAUUSD defaults | PBOS product | No bootstrap equivalent | Legacy implementation | HIST | None | Test/fixture detail. |
| CLAUDE-C008 | CLAUDE | Lock old PBOS MVP dimensions | PBOS product | Piltover product direction | Source of Truth | HIST | None | Obsolete scope. |
| CLAUDE-C009 | CLAUDE | Plain text only; no TipTap | PBOS product | Rich Piltover asset lifecycle | Decision Log D-012; domain docs | HIST | None | Old UI/content constraint. |
| CLAUDE-C010 | CLAUDE | Require persona/pillar confirmation | Governance/Product | Strategy activation gate | Owner Gates G2 | AC | Canonical package | General gate owns it. |
| CLAUDE-C011 | CLAUDE | Use legacy enum constants | Product requirement | No exact mapping | Same as RULES-R020 | ESC | SG-001 | Needs later migration decision. |
| CLAUDE-C012 | CLAUDE | Normalize ratios in code | Product requirement | No exact mapping | Same as RULES-R021 | ESC | SG-001 | Not bootstrap material. |
| CLAUDE-C013 | CLAUDE | Keep legacy AI server-side | Product/Architecture | Worker changes execution path | Same as RULES-R022 | ESC | SG-002 | Trust invariant needs later translation. |
| CLAUDE-C014 | CLAUDE | Sanitize external AI input as data | Security/Context | Structured trust boundary partially covers | Constitution C7; Security Model | ADAPT | AGENTS §4 | Compressed into general untrusted-content rule. |
| CLAUDE-C015 | CLAUDE | Never hardcode model; configure in Settings | PBOS product | Worker/adapter model supersedes it | Constitution C13 | HIST | None | Old provider mechanism. |
| CLAUDE-C016 | CLAUDE | Generate legacy strategy by week | PBOS product | New lifecycle differs | Same as RULES-R029 | HIST | None | Old truncation workaround. |
| CLAUDE-C017 | CLAUDE | Preserve post attribution links | Product/Data | Revision lifecycle/attribution | Content Lifecycle; P9 | AC | Canonical package | Principle covered. |
| CLAUDE-C018 | CLAUDE | Require reason on strategy version change | Product/Data | Exact rule absent | Same as RULES-R028 | ESC | SG-003 | Needs domain owner decision. |
| CLAUDE-C019 | CLAUDE | Use four-field one-snapshot metrics | PBOS product | MetricObservation migration | PBOS migration spec | HIST | None | Explicit schema blocker to replace. |
| CLAUDE-C020 | CLAUDE | Use fixed legacy AI validation/repair pipeline | Product requirement | Partial observability only | Same as RULES-R025 | ESC | SG-002 | Later-phase contract decision. |
| CLAUDE-C021 | CLAUDE | Fixed Prisma/Zod/prompt/state file locations | PBOS implementation | Piltover boundaries not implemented yet | Migration spec | HIST | None | Current code pattern, not durable target. |
| CLAUDE-C022 | CLAUDE | Every data page has fixed UI states | PBOS UI | Production UI deferred | Constitution C15 | HIST | None | P13 owns future UI behavior. |
| CLAUDE-C023 | CLAUDE | Never create files outside current milestone | Execution | Work Order scope | Current AGENTS §4 | REJECT | None | Milestone wording is stale and overly literal. |
| CLAUDE-C024 | CLAUDE | Milestone Done requires build/VERIFY/acceptance/seed | Verification | Proportional evidence and acceptance | Current AGENTS §§4/6 | AC | None | Current contract is more adaptable. |
| CLAUDE-C025 | CLAUDE | Append manual actions to root ToFill | State | Handoff/open inputs | Handoff Protocol | REJECT | None | Recreates retired state file. |
| CLAUDE-C026 | CLAUDE | Force terse/caveman replies | Style | Current user style governs | Owner instruction | REJECT | None | Not repository governance. |
| CLAUDE-C027 | CLAUDE | Codegraph before filesystem search | Tool-specific | Smallest relevant context | Current AGENTS §3 | REJECT | None | Unavailable/optional tool must not gate work. |
| CLAUDE-C028 | CLAUDE | Fixed context percentage and compression stack | Context/Tool | Progressive loading | Current AGENTS §3 | REJECT | None | Obsolete tooling and magic threshold. |
| CLAUDE-C029 | CLAUDE | Read seven retired root files every session | Context | Three-file router | P0.1 final graph | REJECT | None | Directly contradicts P0.1. |
| CLAUDE-C030 | CLAUDE | Maintain retired scaffold after each event | State/Execution | Work Order evidence | Handoff Protocol | REJECT | None | High temporal decay and duplication. |
| CLAUDE-C031 | CLAUDE | Inspect assumptions and escalate material ambiguity | Engineering | Partial fail-closed rule | Constitution C7; current AGENTS §2 | ADAPT | AGENTS §4 | Prevents unsafe guessing without fixed ceremony. |
| CLAUDE-C032 | CLAUDE | Prefer the simplest non-speculative solution | Engineering | Existing capability before dependency | Current AGENTS §4; Constitution C10 | AC | None | Already represented. |
| CLAUDE-C033 | CLAUDE | Make surgical, request-traceable changes | Engineering | Smallest coherent change/no cleanup | Current AGENTS §4 | AC | None | Already represented and enriched by RULES-R011. |
| CLAUDE-C034 | CLAUDE | Define verifiable success and loop to evidence | Execution | Freeze DONE and verify | Current AGENTS §4 | AC | None | Already represented. |
| CLAUDE-C035 | CLAUDE | Auto-load a fixed legacy skill/tool stack | Tool-specific | Task-selected tools | Current context routing | REJECT | None | Non-durable and unavailable-tool risk. |

## DISPOSITION SUMMARY

- ABSORB: 2
- ADAPT: 5
- ALREADY_COVERED: 18
- HISTORICAL_ONLY: 21
- REJECT: 23
- ESCALATE: 11
- Total: 80

## HIGH-VALUE RECOVERIES

### RULES-R004 — authorized data egress

- Source principle: project content must not be sent to external services without authorization.
- Piltover form: combined with the external-content trust-boundary rule in `AGENTS.md` §4.
- Why it earns context: prevents high-cost disclosure and applies across phases.

### RULES-R005 / RULES-R007 — tracked-secret prevention

- Source principle: plaintext credentials never enter tracked files, and staged changes are checked.
- Piltover form: one compressed instruction in `AGENTS.md` §6 covering tracked files, handoff
  evidence, and staged-diff inspection.
- Why it earns context: high safety leverage, high durability, low token cost.

### RULES-R011 — inspect the whole working seam

- Source principle: match existing implementation and change surgically.
- Piltover form: inspect implementation, consumers, and relevant tests; preserve observable
  behavior unless the Work Order changes it.
- Why it earns context: directly protects incremental PBOS migration from accidental rewrites.

### RULES-R023 / CLAUDE-C014 — untrusted content is data

- Source principle: uploaded/pasted/external content must not steer execution.
- Piltover form: a provider-neutral trust-boundary instruction in `AGENTS.md` §4.
- Why it earns context: protects every AI-assisted phase without preserving the old AI pipeline.

### CLAUDE-C031 — fail closed on material ambiguity

- Source principle: surface material confusion rather than silently choosing an interpretation.
- Piltover form: inspect authority/code, then stop mutation and escalate if ambiguity remains.
- Why it earns context: operationalizes Constitution C7 with little context cost.

## REJECTED LEGACY PATTERNS

- The root `STATE/MEMORY/RULES/LOOP/plan/todo/ToFill` lifecycle remains retired.
- Fixed four-agent orchestration and PBOS specialist agents remain retired.
- Graph-first, compression-stack, `/clear`, and fixed context-percentage rules were tool-bound.
- Fixed retry/escalation counts were rejected in favor of evidence-based handling.
- Old milestone, model-provider, UI, schema, and completed scope-exception claims remain migration
  history or later-phase inputs, not active bootstrap authority.
- Generic style prescriptions and language policy were not promoted into repository governance.

## LEGACY SPEC GAPS

### SG-001 — PBOS controlled vocabularies and ratio normalization

- Sources: RULES-R020/R021, CLAUDE-C011/C012.
- Claim: legacy AI outputs used fixed enums and code-side ratio normalization.
- Why not promoted: these are domain/output contracts, not operating rules; the target package does
  not preserve their exact legacy shape.
- Decision needed: a later domain/content migration Work Order must determine which behavior is
  preserved, adapted, or replaced.

### SG-002 — legacy AI trust and validation pipeline

- Sources: RULES-R022/R025, CLAUDE-C013/C020.
- Claim: AI ran server-side through validation, sanitization, constrained output, one repair, and
  prompt-run persistence.
- Why not promoted: Piltover changes the primary execution path to the Personal Codex Worker; the
  legacy mechanism cannot silently become the new contract.
- Decision needed: the relevant worker/content phase must map the useful validation, trust, and
  observability invariants to the approved architecture.

### SG-003 — strategy change reason invariant

- Sources: RULES-R028, CLAUDE-C018.
- Claim: every legacy `StrategyVersion` direction change required a non-null reason.
- Why not promoted: the canonical package defines richer revision/evidence concepts but does not
  state this exact legacy constraint.
- Decision needed: domain/data migration review should preserve or deliberately supersede it.

### SG-004 — desktop packaging portability constraints

- Source: RULES-R032.
- Claim: packaged runtime data, database, uploads, backup, and configuration paths must not depend
  on repository cwd or install-directory writes.
- Why not promoted: the migration spec preserves “packaging knowledge” but detailed packaging
  requirements do not belong in root bootstrap.
- Decision needed: carry this locator into the future packaging/recovery work order and verify it
  against current runtime behavior.

## FILE CHANGES

- `AGENTS.md`: seven net lines added, compressed into four shared operational instructions.
- `CLAUDE.md`: unchanged; no recovered Claude-only delta passed admission.
- `README.md`: unchanged; no human-onboarding gap was found.
- `RULES.md`: remains deleted.
- Application code: NONE.
- P0.2 handoff packet: created under this directory.

## CONTEXT COST

BEFORE:

- `AGENTS.md`: 78 lines / 3,079 bytes.
- `CLAUDE.md`: 13 lines / 651 bytes.
- Autoload total: 91 lines / 3,730 bytes.

AFTER:

- `AGENTS.md`: 85 lines / 3,686 bytes.
- `CLAUDE.md`: 13 lines / 651 bytes.
- Autoload total: 98 lines / 4,337 bytes.

DELTA: +7 lines / +607 bytes. Growth is limited to high-leverage safety and seam-preservation
instructions; no new section or context node was added.

## FINAL CONTEXT GRAPH

```text
                         OWNER
                           |
                           v
                  CANONICAL GOVERNANCE
                           |
                           v
                       AGENTS.md <----- CLAUDE.md
                           |
                           v
                    ACTIVE WORK ORDER
                           |
                           v
                    ACTIVE PHASE SPEC
                           |
                           v
                 SMALLEST RELEVANT SPEC
                           |
                           v
                    CODE + EMPIRICAL STATE
                           |
                           v
                        EVIDENCE
```

The graph is one-way. No retired root context file is an active dependency.

## VERIFICATION

Final deterministic outputs are recorded during closeout.

- Git diff check: PENDING
- Root Markdown architecture: PENDING
- No RULES resurrection: PENDING
- Reference audit: PENDING
- Canonical-path validation: PENDING
- Contradiction audit: PENDING
- Fresh Codex bootstrap: PENDING
- Fresh Claude bootstrap: PENDING
- Secret scan: PENDING
- Scope: PENDING
- Full application test/build: SKIPPED — no runtime/application artifact changed.

## P0.2 ACCEPTANCE

Acceptance is marked PASS only after final verification and review. P1 has not begun.

## NEXT LEGAL PHASE

After P0.2 is DONE: P1 — Architecture Scaffold / Module Boundaries.

DO NOT START P1.
