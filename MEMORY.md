# MEMORY.md — persistent decisions & patterns

> Long-lived knowledge. When a plan.md/todo.md goal is done, distill any lasting
> decision here before deleting those files. One entry = one fact; keep it terse.

## Architecture decisions log
<!-- [YYYY-MM-DD] Decision — why — alternatives rejected -->
- [2026-07-08] **M0 PASS.** Promoted staging `Z-NeededUpdate/{docs,prisma,.env.example}`
  -> repo root. Schema = 22 models, no Campaign/PainPoint/CompanyProfile. Schema uses
  **Prisma v6 syntax** (`datasource.url`); v7 rejects it (P1012). Pin prisma@6 in M1/M2.
- [2026-07-08] Hook commands in `.claude/settings.json` use forward-slash paths
  (`C:/Users/.../rtk.exe`) — bash strips backslashes in Windows paths, turning
  `C:\Users\...` into `C:Users...` = command not found. Applies to all hook commands.
  Generator: `setup-claude-agent-system.ps1` > `Get-RtkCmd` now returns the path with
  `-replace '\\','/'`, so regenerating settings.json won't reintroduce the backslash bug.
- [2026-07-08] CLAUDE.md split into PART A (project) / PART B (engine) + §3a scaffold
  maintenance protocol mapping each root file (LOOP/MEMORY/plan/todo/RULES/SPEC/STATE)
  to when it must be updated. In plan mode, plans go to plan.md by path — never pasted
  into CLAUDE.md/chat.

- [2026-07-08] **M1 PASS** (verified, commit pending — repo not git-init yet). Scaffold =
  Next.js 15 App Router + TS, **Tailwind v3** (config file, not v4 CSS), shadcn primitives
  authored by hand (button/card/badge) to avoid network dep at build. **Prisma NOT installed
  in M1** (deferred to M2 — pin prisma@6 then). `lib/constants.ts` = sole enum source (5
  arrays `as const` + inferred types + `OBJECTIVE_COLORS`). AppShell = Sidebar(8 sections,
  Studio+Calendar one group)+Topbar+PageContainer in `app/layout.tsx`. Build 12/12 static, 0
  type errors. QA gate run via pbos-scope-guard (0 violations) + agent-skills:code-reviewer
  (APPROVE, 0 critical) + pbos-milestone-verifier (5/5 M1 gates PASS).

## Convention tracker
<!-- naming, structure, style rules discovered in this repo -->
- Project docs are staged in `Z-NeededUpdate/docs/` until M0 promotes them to `docs/`.
  CLAUDE.md paths (`docs/milestones.md`, etc.) assume the promoted location.
- **Schema has 22 entities, not 19.** `schema.prisma` + `database-schema.md:17` list all 22;
  the old "19" count (pre-AppState/PromptTemplate/PromptRun) was stale and fixed across all
  docs + scaffold + agent defs on 2026-07-08. M0 gate now checks "22 entity". Use 22.
- 8 project hard rules live in RULES.md > "Project hard rules"; SPEC.md holds the
  condensed Trellis Goal/Scope/Acceptance contract.
- **3-step bootstrap pipeline** (`templates/idea-to-docs-master-prompt.md`): Prompt 1
  (Idea -> 6 docs incl. `CLAUDE.project.md`) -> `setup-claude-agent-system.ps1` (generic
  engine scaffold; CLAUDE.md now has `# PHẦN A` placeholder + `# PHẦN B` engine + §3a) ->
  Prompt 2 (customize SPEC/RULES/STATE/LOOP + spawn `<proj>-*` agents). Docs = single
  source of truth; scaffold only points to them; Prompt 2 owns the merge (no hand-merge).

## Bug workaround registry
<!-- symptom -> root cause -> workaround -> permanent fix ref -->
- (none yet)

## headroom learn output
<!-- `headroom learn --apply` (SessionEnd hook) appends mined patterns here -->