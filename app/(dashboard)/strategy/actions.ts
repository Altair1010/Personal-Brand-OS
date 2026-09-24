"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { OBJECTIVES } from "@/lib/constants";
import { normalizeRecordTo100 } from "@/lib/strategy-engine/normalizeRatio";
import { strategyOutputSchema } from "@/lib/prompts/strategy";
import { weeklyPlanOutputSchema } from "@/lib/prompts/weekly-plan";
import {
  assembleStrategy,
  DAYS_PER_WEEK,
} from "@/lib/strategy-engine/assembleStrategy";
import { createStrategyVersion } from "@/lib/strategy-engine/versioning";
import { strategyVersionToMarkdown } from "@/lib/import-export/markdown";
import type { WeeklyPlanOutput } from "@/lib/prompts/weekly-plan";
import { AgentExecutionGateway } from "@/lib/piltover/modules/agents/application/agent-execution-gateway";
import { PrismaJobQueue } from "@/lib/piltover/modules/agents/infrastructure/prisma-job-queue";
import { stableHash } from "@/lib/piltover/shared/contracts/stable-json";
import { RunResultSchema } from "@/lib/piltover/shared/contracts/control-plane";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";
import { ensureImcPlanFromStrategy } from "@/lib/piltover/vnext/imc-service";
import { resolveCanonicalAgentBinding } from "@/lib/piltover/vnext/canonical-agent-binding";

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
  dailyPlanId: string;
  dayIndex: number;
  plannedObjective: string;
  pillarId: string | null;
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
  editedAt: string | null;
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
          dailyPlanId: d.id,
          dayIndex: d.dayIndex,
          plannedObjective: d.plannedObjective ?? "",
          pillarId: d.plannedPillarId ?? null,
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
    editedAt: version.editedAt ? version.editedAt.toISOString() : null,
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
}): Promise<ActionResult<{ runId: string; status: string }>> {
  const tenant = await resolveLocalTenant(db);
  const appState = await db.appState.findUnique({ where: { id: APPSTATE_ID } });
  if (!appState?.audienceApprovedAt) {
    return {
      ok: false,
      error: "Chưa duyệt Khán giả & Trụ cột. Hãy duyệt trước khi giao Strategy Agent.",
    };
  }
  const goalId = appState.activeGoalId;
  if (!goalId) return { ok: false, error: "Chưa có mục tiêu đang hoạt động." };

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
  if (personas.length < 1) return { ok: false, error: "Cần ít nhất 1 persona đã lưu." };
  if (pillars.length < 1) return { ok: false, error: "Cần ít nhất 1 trụ cột đã lưu." };

  let frameworkSlug: string | undefined;
  let frameworkName: string | undefined;
  if (args.frameworkSlug) {
    const fw = await db.framework.findUnique({ where: { slug: args.frameworkSlug } });
    if (fw) {
      frameworkSlug = fw.slug;
      frameworkName = fw.name;
    }
  }

  const context = {
    goalId,
    frameworkSlug: frameworkSlug ?? null,
    frameworkName: frameworkName ?? null,
    brandDna: {
      whoAmI: brandDna?.whoAmI ?? undefined,
      field: brandDna?.field ?? undefined,
      positioning: brandDna?.aiPositioning ?? undefined,
      threeWords: Array.isArray(brandDna?.threeWords)
        ? (brandDna?.threeWords as unknown[]).filter((w): w is string => typeof w === "string")
        : undefined,
      differentiationSharpened: brandDna?.differentiation ?? undefined,
      summary: brandDna?.usp ?? undefined,
    },
    goal: {
      name: goal.name,
      goalType: goal.goalType,
      targetAudience: goal.targetAudience ?? undefined,
      mainOffer: goal.mainOffer ?? undefined,
    },
    personas: personas.map((p) => ({ name: p.name })),
    pillars: pillars.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? undefined,
    })),
    daysPerWeek: [...DAYS_PER_WEEK],
  };

  const freshAfter = new Date(Date.now() - 60_000);
  const workers = await db.worker.findMany({
    where: { status: "ACTIVE", lastSeenAt: { gt: freshAfter } },
    include: { capabilities: true },
    orderBy: { lastSeenAt: "desc" },
  });
  const openClawWorker = workers.find((worker) =>
    worker.capabilities.some(({ capability }) => capability === "agent.execute.openclaw"),
  );
  const oauthWorker = workers.find((worker) =>
    worker.capabilities.some(({ capability }) => capability === "agent.execute.oauth"),
  );
  const route = openClawWorker
    ? {
        kind: "OPENCLAW" as const,
        controller: "openclaw" as const,
        support: {
          termius: openClawWorker.capabilities.some(({ capability }) => capability === "openclaw.support.termius"),
          router9: openClawWorker.capabilities.some(({ capability }) => capability === "openclaw.support.9router"),
        },
      }
    : oauthWorker
      ? { kind: "OAUTH" as const, connector: oauthWorker.runtimeAdapter }
      : {
          kind: "OPENCLAW" as const,
          controller: "openclaw" as const,
          support: { termius: false, router9: false },
        };

  const contextHash = stableHash(context);
  const agentBinding = await resolveCanonicalAgentBinding(db, "strategy-planner");
  const bindingHash = stableHash(agentBinding).slice(0, 12);
  const dispatched = await new AgentExecutionGateway(new PrismaJobQueue(db)).dispatch({
    organizationId: tenant.organizationId,
    workspaceId: tenant.workspaceId,
    brandId: tenant.brandId,
    ...agentBinding,
    repositoryAlias: "personal-brand-os",
    roleRef: "role:strategy-planner@h1",
    taskType: "STRATEGY_PLAN_30D",
    instruction:
      "Create a 30-day strategy from the supplied Brand, Goal, Persona and Pillar context. Return ONLY the canonical StrategyPlanResult/v2 JSON contract described in contractGuidance. Do not add alternate architecture fields and do not mutate Piltover state directly.",
    contextRef: { id: `strategy-plan:${tenant.brandId}:${contextHash}`, hash: contextHash },
    permissionManifestRef: "permission:h1-strategy-planner",
    route,
    taskPayload: {
      context,
      resultContract: "StrategyPlanResult/v2",
      contractGuidance:
        "Return exactly {tier1,weeklyOutputs}. tier1 must contain contentRatio with exactly seo,educate,trust,conversion,story,community; weeklyThemes exactly 5 items with weekIndex,theme,focusPillar,objectivesMix using those same six keys; ctaPlan[{stage,cta,when}]; topicMap[{pillar,topics[]}]; recommendedTemplates[]; kpiToTrack[]; doNotList[]; assumptions[]. weeklyOutputs must be exactly 5 items; each item is {weekIndex,dailyPlans,notes}; weekIndex 1..5; dailyPlans count must be 7,7,7,7,2; every daily item is {dayIndex,objective,pillar,suggestedTopic,suggestedCta}; objective must be one of seo,educate,trust,conversion,story,community; pillar/focusPillar must exactly match one supplied pillar name.",
    },
    idempotencyKey: `h1-strategy-v2:${tenant.brandId}:${contextHash}:${bindingHash}`,
    requiredCapabilities: ["strategy.plan"],
    priority: 60,
    executionPolicy: { mode: "sequential", resourceKey: `strategy:${tenant.brandId}` },
  });

  revalidatePath("/strategy");
  return { ok: true, data: { runId: dispatched.runId, status: dispatched.status } };
}

export async function getStrategyRunProgress(runId: string): Promise<
  ActionResult<{
    runStatus: string;
    jobStatus: string | null;
    attemptCount: number;
    maxAttempts: number;
    leased: boolean;
    completed: boolean;
    terminal: boolean;
    error: string | null;
  }>
> {
  const tenant = await resolveLocalTenant(db);
  const run = await db.agentRun.findFirst({
    where: {
      id: runId,
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      brandId: tenant.brandId,
      roleRef: "role:strategy-planner@h1",
    },
    include: {
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          status: true,
          attemptCount: true,
          maxAttempts: true,
          currentLeaseId: true,
        },
      },
    },
  });
  if (!run) return { ok: false, error: "Không tìm thấy Strategy Agent run." };
  const job = run.jobs[0] ?? null;
  return {
    ok: true,
    data: {
      runStatus: run.status,
      jobStatus: job?.status ?? null,
      attemptCount: job?.attemptCount ?? 0,
      maxAttempts: job?.maxAttempts ?? 0,
      leased: Boolean(job?.currentLeaseId),
      completed: run.status === "COMPLETED",
      terminal: ["COMPLETED", "FAILED", "CANCELLED"].includes(run.status),
      error:
        run.status === "FAILED" && run.terminalResult && typeof run.terminalResult === "object" && !Array.isArray(run.terminalResult)
          ? (() => {
              const raw = run.terminalResult as Record<string, unknown>;
              const err = raw.error;
              return err && typeof err === "object" && !Array.isArray(err) && typeof (err as Record<string, unknown>).message === "string"
                ? String((err as Record<string, unknown>).message)
                : "Strategy Agent thất bại.";
            })()
          : null,
    },
  };
}

export async function syncStrategyAgentResult(): Promise<
  ActionResult<{ strategyId: string; versionId: string; runId: string }>
> {
  const tenant = await resolveLocalTenant(db);
  const run = await db.agentRun.findFirst({
    where: {
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      brandId: tenant.brandId,
      roleRef: "role:strategy-planner@h1",
      status: "COMPLETED",
    },
    orderBy: { completedAt: "desc" },
  });
  if (!run?.terminalResult) {
    return { ok: false, error: "Chưa có Strategy Agent run hoàn tất." };
  }

  const alreadySynced = await db.strategyVersion.findUnique({
    where: { sourceAgentRunId: run.id },
    select: { id: true, strategyId: true },
  });
  if (alreadySynced) {
    await ensureImcPlanFromStrategy(db, alreadySynced.id);
    return {
      ok: true,
      data: { strategyId: alreadySynced.strategyId, versionId: alreadySynced.id, runId: run.id },
    };
  }

  const terminal = RunResultSchema.parse(run.terminalResult);
  const artifact = terminal.artifacts?.find((item) => item.kind === "strategy-plan-result");
  if (!artifact?.payload || typeof artifact.payload !== "object" || artifact.payload === null) {
    return { ok: false, error: "Strategy Agent chưa trả artifact strategy-plan-result." };
  }
  const raw = artifact.payload as Record<string, unknown>;
  const canonicalPlan = z.object({
    tier1: strategyOutputSchema,
    weeklyOutputs: z.array(weeklyPlanOutputSchema).length(5),
  }).safeParse(raw);
  if (!canonicalPlan.success) {
    const detail = canonicalPlan.error.issues
      .slice(0, 6)
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
    return {
      ok: false,
      error: `Strategy Agent result không đúng StrategyPlanResult/v2: ${detail}`,
    };
  }
  const tier1Raw = canonicalPlan.data.tier1;
  const tier1 = {
    ...tier1Raw,
    contentRatio: normalizeRecordTo100(tier1Raw.contentRatio),
    weeklyThemes: tier1Raw.weeklyThemes.map((w) => ({
      ...w,
      objectivesMix: normalizeRecordTo100(w.objectivesMix),
    })),
  };
  const weeklyOutputsRaw = canonicalPlan.data.weeklyOutputs;
  const weeklyOutputs: WeeklyPlanOutput[] = weeklyOutputsRaw.map((week, index) => {
    const expectedDays = DAYS_PER_WEEK[index];
    if (week.weekIndex !== index + 1 || week.dailyPlans.length !== expectedDays) {
      throw new Error("STRATEGY_AGENT_WEEKLY_PLAN_INVALID");
    }
    return week;
  });

  const task =
    run.task && typeof run.task === "object" && !Array.isArray(run.task)
      ? (run.task as Record<string, unknown>)
      : {};
  const payload =
    task.context && typeof task.context === "object" && !Array.isArray(task.context)
      ? (task.context as Record<string, unknown>)
      : null;
  const goalId = typeof payload?.goalId === "string" ? payload.goalId : null;
  const frameworkSlug = typeof payload?.frameworkSlug === "string" ? payload.frameworkSlug : undefined;
  if (!goalId) return { ok: false, error: "Strategy Agent run thiếu goalId nguồn." };

  const pillars = await db.contentPillar.findMany({
    where: { userId: USER_ID, goalId, status: "active" },
    select: { id: true, name: true },
  });
  const pillarNameToId: Record<string, string> = {};
  for (const pillar of pillars) pillarNameToId[pillar.name] = pillar.id;
  const assembledWeeks = assembleStrategy(tier1, weeklyOutputs, pillarNameToId);
  const goal = await db.goal.findUnique({
    where: { id: goalId },
    select: { name: true, goalType: true, targetAudience: true, mainOffer: true },
  });
  if (!goal) return { ok: false, error: "Không tìm thấy goal của Strategy Agent run." };

  const brandContext =
    payload?.brandDna && typeof payload.brandDna === "object" && !Array.isArray(payload.brandDna)
      ? (payload.brandDna as Record<string, unknown>)
      : {};
  const personasContext = Array.isArray(payload?.personas) ? payload.personas : [];
  const pillarsContext = Array.isArray(payload?.pillars) ? payload.pillars : [];
  const themeSummary = tier1.weeklyThemes.map((item) => item.theme).filter(Boolean).join(" → ");
  const structuredPlan = {
    schemaVersion: "piltover.marketing-strategy/v1",
    diagnosis: {
      assumptions: tier1.assumptions,
      guardrails: tier1.doNotList,
    },
    marketContext: {
      timeframeDays: 30,
      frameworkSlug: frameworkSlug ?? null,
      sourceAgentRunId: run.id,
    },
    audiences: personasContext,
    positioning: {
      ...brandContext,
      targetAudience: goal.targetAudience,
      offer: goal.mainOffer,
    },
    strategicThesis:
      themeSummary || `Execute a 30-day content strategy to achieve ${goal.name}.`,
    objectives: [
      {
        key: goal.goalType,
        name: goal.name,
        contentRatio: tier1.contentRatio,
      },
    ],
    funnel: {
      ctaPlan: tier1.ctaPlan,
    },
    channels: [],
    contentPillars: tier1.topicMap.length ? tier1.topicMap : pillarsContext,
    kpis: tier1.kpiToTrack.map((key) => ({ key })),
    assumptions: tier1.assumptions,
    risks: tier1.doNotList.map((description) => ({
      type: "guardrail",
      description,
    })),
    experiments: [],
  };

  try {
    const result = await createStrategyVersion({
      goalId,
      name: `Chiến lược 30 ngày — ${goal.name}`,
      frameworkSlug,
      tier1,
      assembledWeeks,
      sourceAgentRunId: run.id,
      structuredPlan,
      reason: `Strategy Agent H1 run ${run.id}: tạo kế hoạch 30 ngày từ context đã duyệt`,
    });
    await ensureImcPlanFromStrategy(db, result.versionId);
    revalidatePath("/strategy");
    revalidatePath("/");
    return {
      ok: true,
      data: { strategyId: result.strategyId, versionId: result.versionId, runId: run.id },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Không thể lưu Strategy Agent result.",
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

// ============================================================
// EM2c T9 — Manual edit (sửa tại chỗ, KHÔNG tạo version mới)
// ============================================================

// Enum guard: objective phải thuộc OBJECTIVES (không tin client). pillarId null = gỡ trụ cột.
const updateDailyPlanSchema = z.object({
  plannedObjective: z.enum(OBJECTIVES).optional(),
  suggestedTopic: z.string().optional(),
  suggestedCta: z.string().optional(),
  pillarId: z.string().nullable().optional(),
});
export type UpdateDailyPlanInput = z.input<typeof updateDailyPlanSchema>;

// Sửa 1 ngày (Strategy hoặc Calendar) tại chỗ trên version ĐANG ACTIVE. Post giữ nguyên
// dailyPlanId nên attribution không đổi. Đánh dấu StrategyVersion.editedAt.
export async function updateDailyPlan(
  dailyPlanId: string,
  input: UpdateDailyPlanInput,
): Promise<ActionResult> {
  const parsed = updateDailyPlanSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dữ liệu chỉnh sửa không hợp lệ (mục tiêu ngoài danh sách)." };
  }
  const v = parsed.data;

  const dp = await db.dailyPlan.findUnique({
    where: { id: dailyPlanId },
    include: { weeklyPlan: { include: { strategyVersion: true } } },
  });
  if (!dp) return { ok: false, error: "Không tìm thấy kế hoạch ngày." };

  const appState = await db.appState.findUnique({ where: { id: APPSTATE_ID } });
  const activeStrategyId = appState?.activeStrategyId ?? null;
  if (dp.weeklyPlan.strategyVersion.strategyId !== activeStrategyId) {
    return { ok: false, error: "Chỉ sửa được chiến lược đang hoạt động." };
  }

  const data: Prisma.DailyPlanUpdateInput = {};
  if (v.plannedObjective !== undefined) data.plannedObjective = v.plannedObjective;
  if (v.suggestedTopic !== undefined) data.suggestedTopic = v.suggestedTopic;
  if (v.suggestedCta !== undefined) data.suggestedCta = v.suggestedCta;
  if (v.pillarId !== undefined) {
    if (v.pillarId) {
      // Trụ cột phải thuộc goal đang hoạt động (active).
      const pillar = await db.contentPillar.findFirst({
        where: {
          id: v.pillarId,
          userId: USER_ID,
          goalId: appState?.activeGoalId ?? undefined,
          status: "active",
        },
        select: { id: true },
      });
      if (!pillar) return { ok: false, error: "Trụ cột không hợp lệ." };
      data.plannedPillar = { connect: { id: v.pillarId } };
    } else {
      data.plannedPillar = { disconnect: true };
    }
  }

  await db.$transaction([
    db.dailyPlan.update({ where: { id: dailyPlanId }, data }),
    db.strategyVersion.update({
      where: { id: dp.weeklyPlan.strategyVersionId },
      data: { editedAt: new Date() },
    }),
  ]);

  revalidatePath("/strategy");
  revalidatePath("/calendar");
  return { ok: true, data: undefined };
}

// Sửa khung tháng: contentRatio (chuẩn hoá 100 trong CODE), kpiToTrack, doNotList. Chỉ version active.
const updateStrategyFrameSchema = z.object({
  contentRatio: z.record(z.string(), z.number()).optional(),
  kpiToTrack: z.array(z.string()).optional(),
  doNotList: z.array(z.string()).optional(),
});
export type UpdateStrategyFrameInput = z.input<typeof updateStrategyFrameSchema>;

export async function updateStrategyFrame(
  versionId: string,
  input: UpdateStrategyFrameInput,
): Promise<ActionResult> {
  const parsed = updateStrategyFrameSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dữ liệu khung chiến lược không hợp lệ." };
  }
  const v = parsed.data;

  const version = await db.strategyVersion.findUnique({
    where: { id: versionId },
    select: { id: true, strategyId: true },
  });
  if (!version) return { ok: false, error: "Không tìm thấy phiên bản chiến lược." };

  const appState = await db.appState.findUnique({ where: { id: APPSTATE_ID } });
  if (version.strategyId !== (appState?.activeStrategyId ?? null)) {
    return { ok: false, error: "Chỉ sửa được chiến lược đang hoạt động." };
  }

  const data: Prisma.StrategyVersionUpdateInput = { editedAt: new Date() };
  if (v.contentRatio !== undefined) {
    // NEVER trust the client sum — re-normalize to exactly 100 in code.
    data.contentRatio = normalizeRecordTo100(v.contentRatio);
  }
  if (v.kpiToTrack !== undefined) data.kpiToTrack = v.kpiToTrack;
  if (v.doNotList !== undefined) data.doNotList = v.doNotList;

  await db.strategyVersion.update({ where: { id: versionId }, data });
  revalidatePath("/strategy");
  return { ok: true, data: undefined };
}
