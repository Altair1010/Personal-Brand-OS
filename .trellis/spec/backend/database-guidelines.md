# Database Guidelines

> Prisma + SQLite patterns for Personal Brand OS.

---

## Stack

- **Prisma 6** over **SQLite** (`dev.db`), single-user local app.
- **Always** access the DB through the singleton in `lib/db.ts` (`import { db }` or
  `prisma`). The `globalForPrisma` guard prevents Next.js dev hot-reload from spawning
  duplicate clients. Never call `new PrismaClient()` in feature code.
- Schema is `prisma/schema.prisma` — **exactly 22 MVP entities**. No entity for phase-2
  features.

---

## Query Patterns

- **Upsert on a stable unique key** for save operations (idempotent, no dup rows):

  ```ts
  await db.brandDNA.upsert({
    where: { userId: USER_ID },
    update: data,
    create: { userId: USER_ID, ...data },
  });
  ```

- **Parallelize independent reads** with `Promise.all` (see `getOnboardingData()` in
  onboarding `actions.ts`).
- Fixed singleton ids match the seed: `USER_ID = "local"`, `APPSTATE_ID = "singleton"`.
  `AppState` holds `activeGoalId` / `activeStrategyId`; `UserProfile.id = "local"`.
- Use a **transaction** (`db.$transaction`) when multiple writes must succeed together
  (e.g. approving a draft → create `Post` + link attribution).

---

## Invariants (project hard rules — must be preserved)

- **Versioning**: `StrategyVersion.reason` is non-null — every direction change records a
  reason. `ContentDraft.version` increments.
- **Attribution**: approving a draft creates a `Post` with non-null `strategyVersionId`
  **and** `dailyPlanId`. The Revision Engine depends on these links.
- **Performance metrics**: exactly **one `MetricSnapshot` per `Post`**
  (reach / engagement / comments / saves + note). `daysSincePost` is computed, not stored.
- **Enums** are declared once in `lib/constants.ts` and mirrored (not redefined) in the
  schema layer.

---

## Migrations & Seed

- `npx prisma migrate dev` to create/apply migrations. Migrations must **not** break an
  existing local `dev.db` — note any destructive step and **stop to confirm** before
  applying (RULES.md hard stops).
- Seed (`prisma/seed.ts`, run via `npm run db:seed`) defaults to brand "Khang Guru"
  (XAUUSD); switch domain with `npx prisma db seed -- --domain=dongy`.
- Seed MUST be **idempotent** — upsert on stable keys; re-running never duplicates or
  destroys data. Verify: run seed twice, diff row counts (must be identical).

---

## Verify Before Done

`npx prisma validate` clean · `npx prisma migrate dev` applies · seed run twice = same
state · `npm run build` has no type errors from the generated client.

---

## Common Mistakes

- `new PrismaClient()` outside `lib/db.ts` → connection leaks in dev.
- Non-idempotent seed (create without upsert) → duplicate rows on re-run.
- Creating a `Post` without `strategyVersionId` / `dailyPlanId` → breaks Revision Engine.
- Nullable / empty `StrategyVersion.reason`.
- Adding an entity for a phase-2 feature (out of the 22-entity scope).
