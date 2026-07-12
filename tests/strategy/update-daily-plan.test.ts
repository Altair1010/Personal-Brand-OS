// EM2c T9 — manual edit actions on a real throwaway SQLite DB. Proves:
//  - updateDailyPlan enforces the OBJECTIVES enum (garbage objective rejected, no write);
//  - a valid edit persists in place and stamps StrategyVersion.editedAt (no new version);
//  - editing a non-active strategy is refused;
//  - updateStrategyFrame re-normalizes contentRatio to exactly 100 in code.
// Temp-DB + lib/db mock pattern mirrors tests/settings/set-default.test.ts.

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const holder = vi.hoisted(() => ({
  client: null as unknown as PrismaClient,
}));

vi.mock("@/lib/db", () => ({
  get db() {
    return holder.client;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import {
  updateDailyPlan,
  updateStrategyFrame,
} from "@/app/(dashboard)/strategy/actions";

const TEMP_DB_NAME = "test-update-daily-plan.db";
const TEMP_DB_URL = `file:./${TEMP_DB_NAME}`;
const PRISMA_DIR = path.resolve(__dirname, "..", "..", "prisma");
const TEMP_DB_FILE = path.join(PRISMA_DIR, TEMP_DB_NAME);
const PRISMA_CLI = path.resolve(
  __dirname,
  "..",
  "..",
  "node_modules",
  "prisma",
  "build",
  "index.js",
);

function removeTempDb() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    fs.rmSync(TEMP_DB_FILE + suffix, { force: true });
  }
}

// Build a minimal active-strategy graph and return the ids the tests target.
async function seedGraph(activeStrategy: boolean) {
  const db = holder.client;
  await db.userProfile.upsert({
    where: { id: "local" },
    update: {},
    create: { id: "local", name: "Local" },
  });
  const goal = await db.goal.create({
    data: { userId: "local", name: "Goal", goalType: "sell" },
  });
  const pillar = await db.contentPillar.create({
    data: { userId: "local", goalId: goal.id, name: "Trụ cột A", status: "active" },
  });
  const strategy = await db.strategy.create({
    data: { userId: "local", goalId: goal.id, name: "S" },
  });
  const version = await db.strategyVersion.create({
    data: {
      strategyId: strategy.id,
      version: 1,
      reason: "init",
      contentRatio: { seo: 25, educate: 25, trust: 25, conversion: 25 },
    },
  });
  const week = await db.weeklyPlan.create({
    data: { strategyVersionId: version.id, weekIndex: 1 },
  });
  const daily = await db.dailyPlan.create({
    data: {
      weeklyPlanId: week.id,
      dayIndex: 1,
      plannedObjective: "educate",
      suggestedTopic: "cũ",
    },
  });
  await db.appState.upsert({
    where: { id: "singleton" },
    update: {
      activeGoalId: goal.id,
      activeStrategyId: activeStrategy ? strategy.id : null,
    },
    create: {
      id: "singleton",
      activeGoalId: goal.id,
      activeStrategyId: activeStrategy ? strategy.id : null,
    },
  });
  return { goal, pillar, strategy, version, daily };
}

async function wipe() {
  const db = holder.client;
  await db.dailyPlan.deleteMany();
  await db.weeklyPlan.deleteMany();
  await db.strategyVersion.deleteMany();
  await db.strategy.deleteMany();
  await db.contentPillar.deleteMany();
  await db.goal.deleteMany();
  await db.appState.deleteMany();
  await db.userProfile.deleteMany();
}

beforeAll(async () => {
  removeTempDb();
  execSync(`node "${PRISMA_CLI}" db push --skip-generate`, {
    env: { ...process.env, DATABASE_URL: TEMP_DB_URL },
    stdio: "pipe",
  });
  holder.client = new PrismaClient({
    datasources: { db: { url: TEMP_DB_URL } },
  });
}, 120_000);

afterAll(async () => {
  if (holder.client) await holder.client.$disconnect();
  removeTempDb();
});

beforeEach(wipe);

describe("updateDailyPlan (real temp SQLite)", () => {
  it("rejects an objective outside OBJECTIVES and writes nothing", async () => {
    const { daily } = await seedGraph(true);
    const res = await updateDailyPlan(daily.id, {
      // @ts-expect-error — intentionally invalid enum value
      plannedObjective: "not-an-objective",
      suggestedTopic: "mới",
    });
    expect(res.ok).toBe(false);

    const after = await holder.client.dailyPlan.findUnique({
      where: { id: daily.id },
    });
    expect(after?.suggestedTopic).toBe("cũ"); // unchanged
  });

  it("persists a valid edit in place, connects pillar, and stamps editedAt", async () => {
    const { daily, pillar, version } = await seedGraph(true);
    const res = await updateDailyPlan(daily.id, {
      plannedObjective: "conversion",
      suggestedTopic: "mới",
      suggestedCta: "Mua ngay",
      pillarId: pillar.id,
    });
    expect(res.ok).toBe(true);

    const after = await holder.client.dailyPlan.findUnique({
      where: { id: daily.id },
    });
    expect(after?.plannedObjective).toBe("conversion");
    expect(after?.suggestedTopic).toBe("mới");
    expect(after?.plannedPillarId).toBe(pillar.id);

    // Same version marked edited — no new version created.
    const versions = await holder.client.strategyVersion.findMany();
    expect(versions.length).toBe(1);
    expect(versions[0].id).toBe(version.id);
    expect(versions[0].editedAt).not.toBeNull();
  });

  it("refuses to edit a strategy that is not active", async () => {
    const { daily } = await seedGraph(false);
    const res = await updateDailyPlan(daily.id, { suggestedTopic: "x" });
    expect(res.ok).toBe(false);
  });
});

describe("updateStrategyFrame (real temp SQLite)", () => {
  it("re-normalizes contentRatio to exactly 100", async () => {
    const { version } = await seedGraph(true);
    const res = await updateStrategyFrame(version.id, {
      contentRatio: { seo: 10, educate: 10, trust: 10, conversion: 10 },
      kpiToTrack: ["reach", "engagement"],
    });
    expect(res.ok).toBe(true);

    const after = await holder.client.strategyVersion.findUnique({
      where: { id: version.id },
    });
    const ratio = after?.contentRatio as Record<string, number>;
    const sum = Object.values(ratio).reduce((s, v) => s + v, 0);
    expect(sum).toBe(100);
    expect(after?.editedAt).not.toBeNull();
  });
});
