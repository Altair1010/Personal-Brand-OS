// D.6 Weekly Plan Builder · key="weekly-plan" · temp 0.3
// Role: từ khung 1 tuần (D.4) sinh dailyPlans cho ĐÚNG số ngày trong tuần.
// objective CHỈ lấy từ OBJECTIVES (z.enum). Không có ratio → KHÔNG normalize.

import { z } from "zod";
import type { PromptModule } from "@/lib/ai/run";
import { OBJECTIVES } from "@/lib/constants";

const goalShape = z.object({
  name: z.string().trim().min(1, "Cần goal.name"),
  goalType: z.string().trim().min(1, "Cần goal.goalType"),
  targetAudience: z.string().optional(),
  mainOffer: z.string().optional(),
});

export const weeklyPlanInputSchema = z.object({
  weekIndex: z.number(),
  theme: z.string().min(1),
  focusPillar: z.string().min(1),
  pillars: z.array(z.record(z.string(), z.unknown())).min(1, "Cần ít nhất 1 pillar"),
  goal: goalShape,
  daysInWeek: z.number().int().min(1).max(7),
});

export type WeeklyPlanModuleInput = z.infer<typeof weeklyPlanInputSchema>;

const dailyPlanSchema = z.object({
  dayIndex: z.number(),
  objective: z.enum(OBJECTIVES),
  pillar: z.string().min(1),
  suggestedTopic: z.string().min(1),
  suggestedCta: z.string().min(1),
});

export const weeklyPlanOutputSchema = z.object({
  weekIndex: z.number(),
  dailyPlans: z.array(dailyPlanSchema),
  notes: z.string(),
});

export type WeeklyPlanOutput = z.infer<typeof weeklyPlanOutputSchema>;

const OBJ_LIST = OBJECTIVES.join(", ");

const SELF_CHECK = `SELF-CHECK trước khi trả:
- "dailyPlans" có ĐÚNG số phần tử bằng daysInWeek đã cho; dayIndex = 1..daysInWeek.
- Mỗi "objective" PHẢI là một trong ĐÚNG các giá trị: ${OBJ_LIST}. KHÔNG dùng giá trị khác.
- Mỗi "pillar" PHẢI là tên một pillar đã cho trong input.
- "weekIndex" trả về đúng bằng weekIndex đã cho.`;

const FEW_SHOT = `VÍ DỤ (rút gọn, daysInWeek=3):
Output:
{"weekIndex":1,"dailyPlans":[{"dayIndex":1,"objective":"educate","pillar":"Giáo dục quản trị rủi ro","suggestedTopic":"Quy tắc cắt lỗ 1%","suggestedCta":"Lưu bài để áp dụng"},{"dayIndex":2,"objective":"trust","pillar":"Bằng chứng thực chiến","suggestedTopic":"Nhật ký lệnh tuần qua","suggestedCta":"Theo dõi để xem nhật ký"},{"dayIndex":3,"objective":"community","pillar":"Giáo dục quản trị rủi ro","suggestedTopic":"Bạn quản trị vốn thế nào?","suggestedCta":"Bình luận cách của bạn"}],"notes":"Tuần đặt nền tảng, ưu tiên giáo dục và niềm tin."}`;

const SYSTEM = `Bạn là chiến lược gia nội dung. Từ khung MỘT tuần (theme, focusPillar) và danh sách pillar,
hãy lập kế hoạch từng ngày (dailyPlans) cho ĐÚNG số ngày = daysInWeek đã cho.
Mỗi ngày gồm: dayIndex, objective (một trong ${OBJ_LIST}), pillar (tên pillar đã cho),
suggestedTopic (chủ đề gợi ý), suggestedCta (lời kêu gọi hành động gợi ý).
Trả thêm "notes" (ghi chú ngắn cho cả tuần).

${SELF_CHECK}

${FEW_SHOT}`;

function pillarNames(input: WeeklyPlanModuleInput): string[] {
  return input.pillars
    .map((p) => (typeof p.name === "string" ? p.name : null))
    .filter((n): n is string => !!n);
}

function labelledBlock(input: WeeklyPlanModuleInput): string {
  const fields: [string, string | undefined][] = [
    ["weekIndex", String(input.weekIndex)],
    ["Số ngày cần sinh (daysInWeek)", String(input.daysInWeek)],
    ["Chủ đề tuần (theme)", input.theme],
    ["Pillar trọng tâm (focusPillar)", input.focusPillar],
    ["Các pillar hợp lệ (dùng đúng tên này)", pillarNames(input).join("; ")],
    ["Loại mục tiêu (goal.goalType)", input.goal.goalType],
    ["Offer chính (mainOffer)", input.goal.mainOffer],
  ];
  return fields
    .filter(([, v]) => v && v.trim())
    .map(([label, v]) => `- ${label}: ${v!.trim()}`)
    .join("\n");
}

export const weeklyPlanModule: PromptModule<WeeklyPlanModuleInput, WeeklyPlanOutput> = {
  key: "weekly-plan",
  role: "content strategist",
  temperature: 0.3,
  system: SYSTEM,
  inputSchema: weeklyPlanInputSchema,
  outputSchema: weeklyPlanOutputSchema,
  selfCheck: SELF_CHECK,
  buildUser: (input) => {
    return `Lập kế hoạch cho tuần này:\n${labelledBlock(
      input,
    )}\n\nSinh ĐÚNG ${input.daysInWeek} phần tử trong "dailyPlans". Trả về JSON đúng schema đã mô tả.`;
  },
  // Không có ratio → không normalize.
};
