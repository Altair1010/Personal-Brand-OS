// M6 Strategy assembler — pure transform (NO DB).
// Ghép 5 output tuần (D.6 weekly-plan) + khung tháng (D.4 strategy) → 30 DailyPlan phẳng.
// Chống truncation: mỗi tuần được sinh riêng bởi LLM rồi ghép ở đây.

import { OBJECTIVES, type Objective } from "@/lib/constants";
import type { StrategyOutput } from "@/lib/prompts/strategy";
import type { WeeklyPlanOutput } from "@/lib/prompts/weekly-plan";

// Tổng = 30 ngày, chia 5 tuần: 4 tuần đầy + tuần cuối 2 ngày.
export const DAYS_PER_WEEK = [7, 7, 7, 7, 2] as const;
export const TOTAL_DAYS = DAYS_PER_WEEK.reduce((a, b) => a + b, 0); // 30

// Objective an toàn khi LLM trả giá trị ngoài enum (quyết định: fallback "educate",
// giá trị trung tính nhất — KHÔNG bỏ ngày, vì tổng phải luôn = 30).
const FALLBACK_OBJECTIVE: Objective = "educate";

const OBJECTIVE_SET = new Set<string>(OBJECTIVES);

export interface AssembledDailyPlan {
  dayIndex: number; // GLOBAL 1..30 (liên tục toàn tháng, KHÔNG reset theo tuần)
  plannedObjective: Objective;
  plannedPillarId: string | null; // null nếu tên pillar không khớp map
  suggestedTopic: string;
  suggestedCta: string;
}

export interface AssembledWeek {
  weekIndex: number; // 1..5 (theo khung D.4)
  theme: string | null;
  focusPillarId: string | null;
  objectivesMix: StrategyOutput["weeklyThemes"][number]["objectivesMix"] | null;
  notes: string | null;
  dailyPlans: AssembledDailyPlan[];
}

export type AssembledStrategy = AssembledWeek[];

/**
 * Ghép khung tháng + 5 output tuần → 5 tuần phẳng có 30 DailyPlan.
 *
 * @param tier1        Output D.4 (contentRatio, weeklyThemes[5], ...) — dùng theme/focusPillar/objectivesMix.
 * @param weeklyOutputs 5 output D.6, mỗi phần tử có weekIndex + dailyPlans. Sắp theo weekIndex 1..5.
 * @param pillarNameToId Map tên pillar → id (để resolve focusPillarId & plannedPillarId).
 *
 * Bất biến đảm bảo: tổng dailyPlans === 30; dayIndex liên tục 1..30; plannedObjective ∈ OBJECTIVES.
 */
export function assembleStrategy(
  tier1: StrategyOutput,
  weeklyOutputs: WeeklyPlanOutput[],
  pillarNameToId: Record<string, string>,
): AssembledStrategy {
  // Index các output tuần theo weekIndex để ghép đúng thứ tự bất kể mảng vào lộn xộn.
  const byWeek = new Map<number, WeeklyPlanOutput>();
  for (const w of weeklyOutputs) byWeek.set(w.weekIndex, w);

  const themeByWeek = new Map<number, StrategyOutput["weeklyThemes"][number]>();
  for (const t of tier1.weeklyThemes) themeByWeek.set(t.weekIndex, t);

  const weeks: AssembledStrategy = [];
  let globalDay = 1; // dayIndex chạy liên tục 1..30 xuyên suốt cả tháng.

  for (let i = 0; i < DAYS_PER_WEEK.length; i++) {
    const weekIndex = i + 1; // khung D.4 dùng weekIndex 1..5
    const daysThisWeek = DAYS_PER_WEEK[i];
    const theme = themeByWeek.get(weekIndex) ?? null;
    const weekly = byWeek.get(weekIndex);

    const focusPillarId = theme
      ? pillarNameToId[theme.focusPillar] ?? null
      : null;

    // Chỉ lấy đúng số ngày cần cho tuần này; nếu LLM trả thừa/thiếu, cắt/không bù ở đây
    // — tổng vẫn = 30 vì vòng lặp bên dưới luôn đi đủ daysThisWeek.
    const rawDaily = weekly?.dailyPlans ?? [];
    const dailyPlans: AssembledDailyPlan[] = [];

    for (let d = 0; d < daysThisWeek; d++) {
      const src = rawDaily[d];
      const rawObjective = src?.objective;
      const plannedObjective: Objective =
        rawObjective && OBJECTIVE_SET.has(rawObjective)
          ? (rawObjective as Objective)
          : FALLBACK_OBJECTIVE;

      const pillarName = src?.pillar;
      const plannedPillarId =
        pillarName && pillarNameToId[pillarName] !== undefined
          ? pillarNameToId[pillarName]
          : null;

      dailyPlans.push({
        dayIndex: globalDay,
        plannedObjective,
        plannedPillarId,
        suggestedTopic: src?.suggestedTopic ?? "",
        suggestedCta: src?.suggestedCta ?? "",
      });
      globalDay++;
    }

    weeks.push({
      weekIndex,
      theme: theme?.theme ?? null,
      focusPillarId,
      objectivesMix: theme?.objectivesMix ?? null,
      notes: weekly?.notes ?? null,
      dailyPlans,
    });
  }

  return weeks;
}
