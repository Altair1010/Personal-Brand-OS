// M9 Revision Engine — điều chỉnh chiến lược đang active → tạo version MỚI.
// Tái dùng NGUYÊN VẸN createStrategyVersion (giữ mọi invariant: version=max+1,
// không xóa version cũ, set activeStrategyId, reason non-empty).
// Version mới CLONE đầy đủ WeeklyPlan+DailyPlan từ version cũ (Calendar/approveDraft
// đọc version mới nhất — version rỗng sẽ làm Calendar trống + lệch attribution).
// Single-user: userId="local", AppState id="singleton".

import { db } from "@/lib/db";
import { OBJECTIVES, type Objective } from "@/lib/constants";
import type { StrategyOutput } from "@/lib/prompts/strategy";
import type { AssembledStrategy, AssembledWeek } from "./assembleStrategy";
import { createStrategyVersion } from "./versioning";

const APP_STATE_ID = "singleton";
const FALLBACK_OBJECTIVE: Objective = "educate"; // giống assembleStrategy.ts:15
const OBJECTIVE_SET = new Set<string>(OBJECTIVES);

export interface ApplyRevisionArgs {
  revisedContentRatio: Record<string, number>; // đã normalize=100 ở tầng trên
  reasonForNewVersion: string; // non-empty
}

export interface ApplyRevisionResult {
  strategyId: string;
  versionId: string;
  version: number;
  fromVersion: number;
}

// Ép Json (unknown) về StrategyOutput["contentRatio"] một cách an toàn.
type ContentRatio = StrategyOutput["contentRatio"];

// Các field mảng của StrategyOutput đều là array; null/không-array → [].
function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export async function applyRevision(
  args: ApplyRevisionArgs,
): Promise<ApplyRevisionResult> {
  // 1. Strategy đang active.
  const appState = await db.appState.findUnique({
    where: { id: APP_STATE_ID },
    select: { activeStrategyId: true },
  });
  if (!appState?.activeStrategyId) {
    throw new Error("Chưa có chiến lược đang hoạt động để điều chỉnh.");
  }

  const strategy = await db.strategy.findUnique({
    where: { id: appState.activeStrategyId },
    select: { id: true, goalId: true, name: true, frameworkSlug: true },
  });
  if (!strategy) {
    throw new Error("Không tìm thấy chiến lược đang hoạt động.");
  }

  // 2. Version mới nhất + WeeklyPlan/DailyPlan lồng nhau.
  const oldVersion = await db.strategyVersion.findFirst({
    where: { strategyId: strategy.id },
    orderBy: { version: "desc" },
    include: {
      weeklyPlans: {
        orderBy: { weekIndex: "asc" },
        include: { dailyPlans: { orderBy: { dayIndex: "asc" } } },
      },
    },
  });
  if (!oldVersion) {
    throw new Error("Chiến lược chưa có version nào để điều chỉnh.");
  }

  // 4. tier1 = giữ nguyên Json field cũ, override contentRatio.
  const tier1: StrategyOutput = {
    contentRatio: args.revisedContentRatio as unknown as ContentRatio,
    weeklyThemes: asArray<StrategyOutput["weeklyThemes"][number]>(
      oldVersion.weeklyThemes,
    ),
    ctaPlan: asArray<StrategyOutput["ctaPlan"][number]>(oldVersion.ctaPlan),
    topicMap: asArray<StrategyOutput["topicMap"][number]>(oldVersion.topicMap),
    recommendedTemplates: asArray<string>(oldVersion.recommendedTemplates),
    kpiToTrack: asArray<string>(oldVersion.kpiToTrack),
    doNotList: asArray<string>(oldVersion.doNotList),
    assumptions: asArray<string>(oldVersion.assumptions),
  };

  // 5. assembledWeeks CLONE từ weeklyPlans cũ (DB đã có sẵn mọi field DailyPlan).
  const assembledWeeks: AssembledStrategy = oldVersion.weeklyPlans.map(
    (w): AssembledWeek => ({
      weekIndex: w.weekIndex,
      theme: w.theme,
      focusPillarId: w.focusPillarId,
      objectivesMix:
        (w.objectivesMix as AssembledWeek["objectivesMix"]) ?? null,
      notes: w.notes,
      dailyPlans: w.dailyPlans.map((d) => ({
        dayIndex: d.dayIndex,
        plannedObjective:
          d.plannedObjective && OBJECTIVE_SET.has(d.plannedObjective)
            ? (d.plannedObjective as Objective)
            : FALLBACK_OBJECTIVE,
        plannedPillarId: d.plannedPillarId,
        suggestedTopic: d.suggestedTopic ?? "",
        suggestedCta: d.suggestedCta ?? "",
      })),
    }),
  );

  // 6. Tái dùng createStrategyVersion — KHÔNG tự ghi DB trực tiếp.
  const result = await createStrategyVersion({
    goalId: strategy.goalId,
    name: strategy.name,
    frameworkSlug: strategy.frameworkSlug ?? undefined,
    tier1,
    assembledWeeks,
    reason: args.reasonForNewVersion,
  });

  return { ...result, fromVersion: oldVersion.version };
}
