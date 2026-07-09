// M6 Strategy versioning — ghi DB trong 1 transaction.
// Single-user: userId="local", AppState id="singleton".
// Bất biến KHÓA: StrategyVersion.reason non-null/non-empty; version tăng dần, KHÔNG xóa version cũ.

import { db } from "@/lib/db";
import type { StrategyOutput } from "@/lib/prompts/strategy";
import type { AssembledStrategy } from "./assembleStrategy";

const USER_ID = "local";
const APP_STATE_ID = "singleton";

export interface CreateStrategyVersionArgs {
  goalId: string;
  name: string;
  frameworkSlug?: string;
  tier1: StrategyOutput; // output D.4 — nguồn cho các Json field cấp version
  assembledWeeks: AssembledStrategy; // 5 tuần + 30 DailyPlan đã ghép
  aiPromptRunId?: string; // attribution: link về PromptRun nếu có
  reason: string; // BẮT BUỘC non-empty
}

export interface CreateStrategyVersionResult {
  strategyId: string;
  versionId: string;
  version: number;
}

/**
 * Tạo StrategyVersion mới (v tiếp theo) cho goal, kèm WeeklyPlan[] + DailyPlan[].
 * Không bao giờ xóa/ghi đè version cũ. Set AppState.activeStrategyId.
 */
export async function createStrategyVersion(
  args: CreateStrategyVersionArgs,
): Promise<CreateStrategyVersionResult> {
  const reason = args.reason?.trim();
  if (!reason) {
    // Invariant khóa: mọi đổi hướng phải ghi lý do.
    throw new Error("StrategyVersion.reason là bắt buộc (non-empty).");
  }

  return db.$transaction(async (tx) => {
    // 1. Tìm/tạo Strategy cho (userId, goalId).
    let strategy = await tx.strategy.findFirst({
      where: { userId: USER_ID, goalId: args.goalId },
    });
    if (!strategy) {
      strategy = await tx.strategy.create({
        data: {
          userId: USER_ID,
          goalId: args.goalId,
          name: args.name,
          timeframeDays: 30,
          frameworkSlug: args.frameworkSlug ?? null,
          status: "active",
        },
      });
    }

    // 2. version tiếp theo = max(version)+1 (v1 nếu chưa có). KHÔNG xóa version cũ.
    const latest = await tx.strategyVersion.findFirst({
      where: { strategyId: strategy.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    const t = args.tier1;
    // dailyPlanOutline gọn: mỗi tuần → theme + danh sách objective từng ngày (không lặp full topic).
    const dailyPlanOutline = args.assembledWeeks.map((w) => ({
      weekIndex: w.weekIndex,
      theme: w.theme,
      days: w.dailyPlans.map((d) => ({
        dayIndex: d.dayIndex,
        objective: d.plannedObjective,
      })),
    }));

    // 3. Tạo StrategyVersion + WeeklyPlan[] + DailyPlan[] lồng nhau.
    const version = await tx.strategyVersion.create({
      data: {
        strategyId: strategy.id,
        version: nextVersion,
        reason,
        assumptions: t.assumptions,
        contentRatio: t.contentRatio,
        weeklyThemes: t.weeklyThemes,
        dailyPlanOutline,
        ctaPlan: t.ctaPlan,
        topicMap: t.topicMap,
        recommendedTemplates: t.recommendedTemplates,
        kpiToTrack: t.kpiToTrack,
        doNotList: t.doNotList,
        aiPromptRunId: args.aiPromptRunId ?? null,
        weeklyPlans: {
          create: args.assembledWeeks.map((w) => ({
            weekIndex: w.weekIndex,
            theme: w.theme,
            focusPillarId: w.focusPillarId,
            objectivesMix: w.objectivesMix ?? undefined,
            notes: w.notes,
            dailyPlans: {
              create: w.dailyPlans.map((d) => ({
                dayIndex: d.dayIndex,
                plannedObjective: d.plannedObjective,
                plannedPillarId: d.plannedPillarId,
                suggestedTopic: d.suggestedTopic,
                suggestedCta: d.suggestedCta,
                status: "planned",
              })),
            },
          })),
        },
      },
    });

    // 4. Set active strategy (upsert singleton).
    await tx.appState.upsert({
      where: { id: APP_STATE_ID },
      update: { activeStrategyId: strategy.id },
      create: { id: APP_STATE_ID, activeStrategyId: strategy.id },
    });

    return {
      strategyId: strategy.id,
      versionId: version.id,
      version: nextVersion,
    };
  });
}
