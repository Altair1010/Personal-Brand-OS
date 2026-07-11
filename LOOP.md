# LOOP.md — loop definitions

## Daily triage loop
1. Read STATE.md + plan.md + todo.md.
2. Pick the highest-priority open item (triage).
3. Implement it (surgical change) -> update plan.md/todo.md.
4. Verify against the Done criteria.
5. On pass: move item to Done, sync STATE.md, distill decisions to MEMORY.md.

## Milestone execution loop (the thinking journey for every Mx / EMx task)
> One milestone per `/clear` session. This is the default loop for project work —
> applies to Extended Milestones EM1a/EM1b/EM1c too (milestones.md PHẦN 4).
1. `/clear`, then read ONLY the milestone's section of `docs/milestones.md` (+ files it
   lists). Do not read the whole doc — protect context.
2. Write plan.md (Context/Goal/Assumptions/Steps/Done) + todo.md checklist for this Mx.
3. Implement per-step, surgical. After each step append `[HH:MM] step -> verify` to
   plan.md and tick todo.md. When context >70%: commit, `/clear`, resume from plan.md.
4. VERIFY: `npm run build` clean + milestone VERIFY block + feature-spec acceptance +
   seed idempotent. Fail -> fix, re-run; same step fails twice -> escalate (RULES.md).
5. On pass: commit `Mx: <goal>`, distill the lasting decision to MEMORY.md, delete
   plan.md/todo.md, update STATE.md (move Mx to Completed, set Next = M(x+1)).

## Goal conditions (/goal syntax)
- /goal: tests pass && lint clean && build ok

## Verifier
- agent: verifier (tests + lint + type-checks, isolated worktree).
- Verifier checks the "Done criteria" section of plan.md — not a vague "make it work".

## Cost caps per run
- max_iterations: 10 | max_tokens: 200k | max_duration: 30m | max_cost: $5