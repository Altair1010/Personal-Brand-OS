# CLAUDE.md — Piltover adapter

Piltover evolves the existing PBOS repository by incremental migration.

Treat `AGENTS.md` as the shared canonical repository bootstrap. Read it first, then follow its
authority order, progressive context loading, Work Order, and Owner gates.

Claude-specific delta:

- Do not maintain a separate root constitution, project memory, state file, plan, or TODO system.
- Put durable task evidence in `.piltover/handoffs/<WORK_ORDER_ID>/`, not in auto-loaded context.
- Load only the active phase and the smallest relevant package/source slice.
- Do not continue into the next phase after the current Work Order is DONE.
