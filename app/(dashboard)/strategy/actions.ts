"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { runModule } from "@/lib/ai/run";
import { strategyModule } from "@/lib/prompts/strategy";
import { weeklyPlanModule } from "@/lib/prompts/weekly-plan";
import {
  assembleStrategy,
  DAYS_PER_WEEK,
} from "@/lib/strategy-engine/assembleStrategy";
import { createStrategyVersion } from "@/lib/strategy-engine/versioning";
import { strategyVersionToMarkdown } from "@/lib/import-export/markdown";
import type { WeeklyPlanOutput } from "@/lib/prompts/weekly-plan";

// Single-user local app: fixed ids match the seed (prisma/seed.ts).
const USER_ID = "local";
const APPSTATE_ID = "singleton";

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// --- Serializable DTOs handed to the client wizard ---
export type BrandContextDTO = {
  whoAmI?: string;
  field?: string;
  positioning?: string;
  threeWords?: string[];
  differentiationSharpened?: string;
  summary?: string;
};

export type GoalContextDTO = {
  id: string;
  name: string;
  goalType: string;
  targetAudience?: string;
  mainOffer?: string;
};

export type PersonaContextDTO = { id: string; name: string };

export type PillarContextDTO = {
  id: string;
  name: string;
  description: string | null;
  ratioPercent: number;
};

export type FrameworkDTO = {
  slug: string;
  name: string;
  summary: string | null;
};

export type StrategyDailyPlanDTO = {
  dayIndex: number;
  plannedObjective: string;
  pillarName: string | null;
  suggestedTopic: string;
  suggestedCta: string;
};

export type StrategyWeekDTO = {
  weekIndex: number;
  theme: string | null;
  focusPillarName: string | null;
  objectivesMix: Record<string, number> | null;
  notes: string | null;
  dailyPlans: StrategyDailyPlanDTO[];
};

export type CtaPlanItemDTO = { stage: string; cta: string; when: string };
export type TopicMapItemDTO = { pillar: string; topics: string[] };

export type StrategyDTO = {
  strategyId: string;
  versionId: string;
  version: number;
  name: string;
  reason: string;
  frameworkSlug: string | null;
  contentRatio: Record<string, number> | null;
  weeks: StrategyWeekDTO[];
  ctaPlan: CtaPlanItemDTO[];
  topicMap: TopicMapItemDTO[];
  kpiToTrack: string[];
  doNotList: string[];
  assumptions: string[];
  createdAt: string;
};

export type StrategyData = {
  approvedAt: string | null;
  brand: BrandContextDTO;
  goal: GoalContextDTO | null;
  personas: PersonaContextDTO[];
  pillars: PillarContextDTO[];
  frameworks: FrameworkDTO[];
  strategy: StrategyDTO | null;
};

// --- Json helpers (StrategyVersion Json fields may be null) ---
type Ratio = Record<string, number>;

function asRatio(v: Prisma.JsonValue | null | undefined): Ratio | null {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const out: Ratio = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === "number") out[k] = val;
    }
    return out;
  }
  return null;
}

function asStringArray(v: Prisma.JsonValue | null | undefined): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : [];
}

function asCtaPlan(v: Prisma.JsonValue | null | undefined): CtaPlanItemDTO[] {
  if (!Array.isArray(v)) return [];
  const out: CtaPlanItemDTO[] = [];
  for (const item of v) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const o = item as Record<string, unknown>;
      out.push({
        stage: typeof o.stage === "string" ? o.stage : "",
        cta: typeof o.cta === "string" ? o.cta : "",
        when: typeof o.when === "string" ? o.when : "",
      });
    }
  }
  return out;
}

function asTopicMap(v: Prisma.JsonValue | null | undefined): TopicMapItemDTO[] {
  if (!Array.isArray(v)) return [];
  const out: TopicMapItemDTO[] = [];
  for (const item of v) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const o = item as Record<string, unknown>;
      out.push({
        pillar: typeof o.pillar === "string" ? o.pillar : "",
        topics: Array.isArray(o.topics)
          ? o.topics.filter((t): t is string => typeof t === "string")
          : [],
      });
    }
  }
  return out;
}

async function getActiveGoalId(): Promise<string | null> {
  const appState = await db.appState.findUnique({ where: { id: APPSTATE_ID } });
  return appState?.activeGoalId ?? null;
}

// Type of a StrategyVersion with the relations we serialize.
type VersionWithPlans = Prisma.StrategyVersionGetPayload<{
  include: {
    strategy: true;
    weeklyPlans: { include: { dailyPlans: true } };
  };
}>;

function toStrategyDTO(
  version: VersionWithPlans,
  pillarIdToName: Record<string, string>,
): StrategyDTO {
  const weeks = [...version.weeklyPlans]
    .sort((a, b) => a.weekIndex - b.weekIndex)
    .map<StrategyWeekDTO>((w) => ({
      weekIndex: w.weekIndex,
      theme: w.theme,
      focusPillarName: w.focusPillarId
        ? pillarIdToName[w.focusPillarId] ?? null
        : null,
      objectivesMix: asRatio(w.objectivesMix),
      notes: w.notes,
      dailyPlans: [...w.dailyPlans]
        .sort((a, b) => a.dayIndex - b.dayIndex)
        .map<StrategyDailyPlanDTO>((d) => ({
          dayIndex: d.dayIndex,
          plannedObjective: d.plannedObjective ?? "",
          pillarName: d.plannedPillarId
            ? pillarIdToName[d.plannedPillarId] ?? null
            : null,
          suggestedTopic: d.suggestedTopic ?? "",
          suggestedCta: d.suggestedCta ?? "",
        })),
    }));

  return {
    strategyId: version.strategyId,
    versionId: version.id,
    version: version.version,
    name: version.strategy?.name ?? "Chiến lược 30 ngày",
    reason: version.reason,
    frameworkSlug: version.strategy?.frameworkSlug ?? null,
    contentRatio: asRatio(version.contentRatio),
    weeks,
    ctaPlan: asCtaPlan(version.ctaPlan),
    topicMap: asTopicMap(version.topicMap),
    kpiToTrack: asStringArray(version.kpiToTrack),
    doNotList: asStringArray(version.doNotList),
    assumptions: asStringArray(version.assumptions),
    createdAt: version.createdAt.toISOString(),
  };
}

// --- Read strategy screen data (context + current strategy) ---
export async function getStrategyData(): Promise<StrategyData> {
  const [brandDna, appState, frameworks] = await Promise.all([
    db.brandDNA.findUnique({ where: { userId: USER_ID } }),
    db.appState.findUnique({ where: { id: APPSTATE_ID } }),
    db.framework.findMany({ orderBy: { name: "asc" } }),
  ]);

  const activeGoalId = appState?.activeGoalId ?? null;
  const activeStrategyId = appState?.activeStrategyId ?? null;

  const [goal, personas, pillars] = await Promise.all([
    activeGoalId
      ? db.goal.findUnique({ where: { id: activeGoalId } })
      : Promise.resolve(null),
    activeGoalId
      ? db.audienceSegment.findMany({
          where: { userId: USER_ID, goalId: activeGoalId },
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    activeGoalId
      ? db.contentPillar.findMany({
          where: { userId: USER_ID, goalId: activeGoalId, status: "active" },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const pillarIdToName: Record<string, string> = {};
  for (const p of pillars) pillarIdToName[p.id] = p.name;

  const versionRow = activeStrategyId
    ? await db.strategyVersion.findFirst({
        where: { strategyId: activeStrategyId },
        orderBy: { version: "desc" },
        include: {
          strategy: true,
          weeklyPlans: { include: { dailyPlans: true } },
        },
      })
    : null;

  const brand: BrandContextDTO = {
    whoAmI: brandDna?.whoAmI ?? undefined,
    field: brandDna?.field ?? undefined,
    positioning: brandDna?.aiPositioning ?? undefined,
    threeWords: Array.isArray(brandDna?.threeWords)
      ? (brandDna?.threeWords as unknown[]).filter(
          (w): w is string => typeof w === "string",
        )
      : undefined,
    differentiationSharpened: brandDna?.differentiation ?? undefined,
    summary: brandDna?.usp ?? undefined,
  };

  return {
    approvedAt: appState?.audienceApprovedAt
      ? appState.audienceApprovedAt.toISOString()
      : null,
    brand,
    goal: goal
      ? {
          id: goal.id,
          name: goal.name,
          goalType: goal.goalType,
          targetAudience: goal.targetAudience ?? undefined,
          mainOffer: goal.mainOffer ?? undefined,
        }
      : null,
    personas: personas.map((p) => ({ id: p.id, name: p.name })),
    pillars: pillars.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      ratioPercent: p.ratioPercent,
    })),
    frameworks: frameworks.map((f) => ({
      slug: f.slug,
      name: f.name,
      summary: f.summary,
    })),
    strategy: versionRow ? toStrategyDTO(versionRow, pillarIdToName) : null,
  };
}

// --- Generate a 30-day strategy: tier-1 month frame → 5 weekly plans → assemble → persist ---
export async function generateStrategy(args: {
  frameworkSlug?: string;
}): Promise<ActionResult<{ strategyId: string; versionId: string }>> {
  const appState = await db.appState.findUnique({ where: { id: APPSTATE_ID } });
  if (!appState?.audienceApprovedAt) {
    return {
      ok: false,
      error: "Chưa duyệt Khán giả & Trụ cột. Hãy duyệt trước khi sinh chiến lược.",
    };
  }
  const goalId = appState.activeGoalId;
  if (!goalId) {
    return { ok: false, error: "Chưa có mục tiêu đang hoạt động." };
  }

  const [brandDna, goal, personas, pillars] = await Promise.all([
    db.brandDNA.findUnique({ where: { userId: USER_ID } }),
    db.goal.findUnique({ where: { id: goalId } }),
    db.audienceSegment.findMany({
      where: { userId: USER_ID, goalId },
      orderBy: { createdAt: "asc" },
    }),
    db.contentPillar.findMany({
      where: { userId: USER_ID, goalId, status: "active" },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!goal) return { ok: false, error: "Không tìm thấy mục tiêu." };
  if (personas.length < 1)
    return { ok: false, error: "Cần ít nhất 1 persona đã lưu." };
  if (pillars.length < 1)
    return { ok: false, error: "Cần ít nhất 1 trụ cột đã lưu." };

  // Resolve framework (optional). Invalid slug → treat as no framework.
  let frameworkSlug: string | undefined;
  let frameworkName: string | undefined;
  if (args.frameworkSlug) {
    const fw = await db.framework.findUnique({
      where: { slug: args.frameworkSlug },
    });
    if (fw) {
      frameworkSlug = fw.slug;
      frameworkName = fw.name;
    }
  }

  const brandDnaInput = {
    whoAmI: brandDna?.whoAmI ?? undefined,
    field: brandDna?.field ?? undefined,
    positioning: brandDna?.aiPositioning ?? undefined,
    threeWords: Array.isArray(brandDna?.threeWords)
      ? (brandDna?.threeWords as unknown[]).filter(
          (w): w is string => typeof w === "string",
        )
      : undefined,
    differentiationSharpened: brandDna?.differentiation ?? undefined,
    summary: brandDna?.usp ?? undefined,
  };

  const goalInput = {
    name: goal.name,
    goalType: goal.goalType,
    targetAudience: goal.targetAudience ?? undefined,
    mainOffer: goal.mainOffer ?? undefined,
  };

  const personaInput = personas.map((p) => ({ name: p.name }));
  const pillarInput = pillars.map((p) => ({
    name: p.name,
    description: p.description ?? undefined,
  }));

  // Tier 1: month frame (weeklyThemes[5], contentRatio, ...).
  const tier1Res = await runModule(strategyModule, {
    brandDna: brandDnaInput,
    goal: goalInput,
    personas: personaInput,
    pillars: pillarInput,
    framework: frameworkName,
  });
  if (!tier1Res.ok) {
    return {
      ok: false,
      error: `Dựng khung tháng thất bại: ${tier1Res.error}`,
    };
  }
  const tier1 = tier1Res.data;

  // Tier 2: 5 weekly plans. One week failing must not corrupt the others — collect,
  // and if any week fails, report which week and DO NOT persist a partial version.
  const weeklyOutputs: WeeklyPlanOutput[] = [];
  for (let i = 0; i < DAYS_PER_WEEK.length; i++) {
    const weekIndex = i + 1;
    const theme = tier1.weeklyThemes[i];
    const weeklyRes = await runModule(weeklyPlanModule, {
      weekIndex,
      theme: theme.theme,
      focusPillar: theme.focusPillar,
      pillars: pillarInput,
      goal: goalInput,
      daysInWeek: DAYS_PER_WEEK[i],
    });
    if (!weeklyRes.ok) {
      return {
        ok: false,
        error: `Lập kế hoạch tuần ${weekIndex} thất bại: ${weeklyRes.error}`,
      };
    }
    weeklyOutputs.push(weeklyRes.data);
  }

  // Assemble: map pillar name → id, flatten to 30 daily plans.
  const pillarNameToId: Record<string, string> = {};
  for (const p of pillars) pillarNameToId[p.name] = p.id;
  const assembledWeeks = assembleStrategy(tier1, weeklyOutputs, pillarNameToId);

  // Best-effort attribution: link the most recent tier-1 PromptRun.
  const lastRun = await db.promptRun.findFirst({
    where: { moduleKey: strategyModule.key, status: "ok" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  try {
    const result = await createStrategyVersion({
      goalId,
      name: `Chiến lược 30 ngày — ${goal.name}`,
      frameworkSlug,
      tier1,
      assembledWeeks,
      aiPromptRunId: lastRun?.id,
      reason:
        "Khởi tạo chiến lược 30 ngày từ Brand DNA, persona và trụ cột đã duyệt",
    });
    revalidatePath("/strategy");
    return {
      ok: true,
      data: { strategyId: result.strategyId, versionId: result.versionId },
    };
  } catch (e) {
    return {
      ok: false,
      error: `Lưu phiên bản chiến lược thất bại: ${
        e instanceof Error ? e.message : String(e)
      }`,
    };
  }
}

// --- Export a strategy version to Markdown (reuses the pure formatter + ExportHistory) ---
export async function exportStrategyMd(args: {
  strategyVersionId: string;
}): Promise<ActionResult<{ markdown: string; filename: string }>> {
  const version = await db.strategyVersion.findUnique({
    where: { id: args.strategyVersionId },
    include: {
      strategy: true,
      weeklyPlans: { include: { dailyPlans: true } },
    },
  });
  if (!version) {
    return { ok: false, error: "Không tìm thấy phiên bản chiến lược." };
  }

  const markdown = strategyVersionToMarkdown(version);
  const slug = (version.strategy?.name ?? "strategy")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const filename = `${slug || "strategy"}-v${version.version}.md`;

  await db.exportHistory.create({
    data: {
      userId: USER_ID,
      kind: "markdown",
      scope: "strategy",
      filename,
    },
  });

  return { ok: true, data: { markdown, filename } };
}
