// D.4 Strategy Builder · key="strategy" · temp 0.3
// Role: chiến lược tháng — CHỈ sinh KHUNG THÁNG (khung tuần), KHÔNG sinh dailyPlan.
// Chống truncation: mỗi tuần chi tiết (D.6 weekly-plan) được sinh riêng rồi ghép ở server.
// Enum keys của contentRatio/objectivesMix CHỈ từ OBJECTIVES; ratio normalize về 100 IN CODE.

import { z } from "zod";
import type { PromptModule } from "@/lib/ai/run";
import { OBJECTIVES } from "@/lib/constants";
import { normalizeRecordTo100 } from "@/lib/strategy-engine/normalizeRatio";

const brandDnaShape = z.object({
  whoAmI: z.string().optional(),
  field: z.string().optional(),
  positioning: z.string().optional(),
  threeWords: z.array(z.string()).optional(),
  differentiationSharpened: z.string().optional(),
  voiceTraits: z.array(z.string()).optional(),
  summary: z.string().optional(),
});

const goalShape = z.object({
  name: z.string().trim().min(1, "Cần goal.name"),
  goalType: z.string().trim().min(1, "Cần goal.goalType"),
  targetAudience: z.string().optional(),
  mainOffer: z.string().optional(),
});

export const strategyInputSchema = z.object({
  brandDna: brandDnaShape,
  goal: goalShape,
  personas: z.array(z.record(z.string(), z.unknown())).min(1, "Cần ít nhất 1 persona"),
  pillars: z.array(z.record(z.string(), z.unknown())).min(1, "Cần ít nhất 1 pillar"),
  framework: z.string().optional(),
});

export type StrategyModuleInput = z.infer<typeof strategyInputSchema>;

// objectiveMix / contentRatio keys là ĐÚNG 6 OBJECTIVES — dựng từ constants, không để LLM tự đặt.
const objectiveMixSchema = z.object(
  Object.fromEntries(OBJECTIVES.map((k) => [k, z.number()])) as Record<
    (typeof OBJECTIVES)[number],
    z.ZodNumber
  >,
);

export type ObjectiveMix = z.infer<typeof objectiveMixSchema>;

const weeklyThemeSchema = z.object({
  weekIndex: z.number(),
  theme: z.string().min(1),
  focusPillar: z.string().min(1),
  objectivesMix: objectiveMixSchema,
});

export const strategyOutputSchema = z.object({
  contentRatio: objectiveMixSchema,
  weeklyThemes: z.array(weeklyThemeSchema).length(5, "weeklyThemes phải có ĐÚNG 5 phần tử"),
  ctaPlan: z.array(
    z.object({ stage: z.string().min(1), cta: z.string().min(1), when: z.string().min(1) }),
  ),
  topicMap: z.array(
    z.object({ pillar: z.string().min(1), topics: z.array(z.string()) }),
  ),
  recommendedTemplates: z.array(z.string()),
  kpiToTrack: z.array(z.string()),
  doNotList: z.array(z.string()),
  assumptions: z.array(z.string()),
});

export type StrategyOutput = z.infer<typeof strategyOutputSchema>;

const OBJ_LIST = OBJECTIVES.join(", ");

const SELF_CHECK = `SELF-CHECK trước khi trả:
- "weeklyThemes" có ĐÚNG 5 phần tử, weekIndex = 1..5.
- "contentRatio" dùng ĐÚNG 6 khóa: ${OBJ_LIST}; giá trị cộng ≈ 100 (hệ thống sẽ tự chuẩn hóa lại về 100).
- Mỗi "weeklyThemes[].objectivesMix" cũng dùng ĐÚNG 6 khóa trên; giá trị cộng ≈ 100 (hệ thống chuẩn hóa lại).
- "focusPillar" của mỗi tuần PHẢI là tên một pillar đã cho trong input.
- KHÔNG thêm/đổi tên khóa ngoài 6 giá trị enum trên.
- KHÔNG sinh dailyPlan/kế hoạch từng ngày — chỉ khung tuần.`;

const FEW_SHOT = `VÍ DỤ (rút gọn, brand trading XAUUSD):
Output:
{"contentRatio":{"seo":10,"educate":35,"trust":25,"conversion":15,"story":10,"community":5},"weeklyThemes":[{"weekIndex":1,"theme":"Nền tảng quản trị rủi ro","focusPillar":"Giáo dục quản trị rủi ro","objectivesMix":{"seo":10,"educate":50,"trust":20,"conversion":5,"story":5,"community":10}},{"weekIndex":2,"theme":"Bằng chứng thực chiến","focusPillar":"Bằng chứng thực chiến","objectivesMix":{"seo":5,"educate":20,"trust":45,"conversion":10,"story":15,"community":5}},{"weekIndex":3,"theme":"Tâm lý giao dịch","focusPillar":"Giáo dục quản trị rủi ro","objectivesMix":{"seo":10,"educate":40,"trust":25,"conversion":10,"story":10,"community":5}},{"weekIndex":4,"theme":"Lộ trình chuyển đổi","focusPillar":"Chuyển đổi khóa học","objectivesMix":{"seo":5,"educate":15,"trust":15,"conversion":50,"story":10,"community":5}},{"weekIndex":5,"theme":"Cộng đồng & cam kết","focusPillar":"Bằng chứng thực chiến","objectivesMix":{"seo":5,"educate":20,"trust":30,"conversion":15,"story":10,"community":20}}],"ctaPlan":[{"stage":"nhận biết","cta":"Theo dõi để nhận nhật ký lệnh","when":"tuần 1-2"},{"stage":"chuyển đổi","cta":"Đăng ký lộ trình học","when":"tuần 4"}],"topicMap":[{"pillar":"Giáo dục quản trị rủi ro","topics":["quản trị vốn","cắt lỗ kỷ luật"]}],"recommendedTemplates":["nhật ký lệnh","phân tích sai lầm"],"kpiToTrack":["reach","tỷ lệ lưu bài"],"doNotList":["hứa lợi nhuận chắc chắn"],"assumptions":[]}`;

const SYSTEM = `Bạn là chiến lược gia nội dung. Từ Brand DNA, mục tiêu (goal), personas và các content pillar,
hãy dựng KHUNG CHIẾN LƯỢC 30 ngày ở mức THÁNG — chia thành ĐÚNG 5 tuần.
KHÔNG sinh kế hoạch từng ngày (dailyPlan) — mỗi tuần sẽ được lập chi tiết ở bước sau.
Trả về:
- "contentRatio": tỷ trọng nội dung toàn tháng theo ĐÚNG 6 mục tiêu: ${OBJ_LIST}.
- "weeklyThemes": ĐÚNG 5 tuần, mỗi tuần gồm weekIndex, theme, focusPillar (tên một pillar đã cho), objectivesMix (6 khóa).
- "ctaPlan": các chặng CTA theo giai đoạn.
- "topicMap": bản đồ chủ đề theo từng pillar.
- "recommendedTemplates", "kpiToTrack", "doNotList", "assumptions".

${SELF_CHECK}

${FEW_SHOT}`;

function pillarNames(input: StrategyModuleInput): string[] {
  return input.pillars
    .map((p) => (typeof p.name === "string" ? p.name : null))
    .filter((n): n is string => !!n);
}

function labelledBlock(input: StrategyModuleInput): string {
  const d = input.brandDna;
  const g = input.goal;
  const personaNames = input.personas
    .map((p) => (typeof p.name === "string" ? p.name : null))
    .filter((n): n is string => !!n);
  const fields: [string, string | undefined][] = [
    ["Định vị (positioning)", d.positioning],
    ["Lĩnh vực (field)", d.field],
    ["Khác biệt (differentiation)", d.differentiationSharpened],
    ["Tên mục tiêu (goal.name)", g.name],
    ["Loại mục tiêu (goal.goalType)", g.goalType],
    ["Đối tượng (targetAudience)", g.targetAudience],
    ["Offer chính (mainOffer)", g.mainOffer],
    ["Personas", personaNames.join("; ")],
    ["Content pillars (dùng đúng tên này cho focusPillar)", pillarNames(input).join("; ")],
    ["Framework (nếu có)", input.framework],
  ];
  return fields
    .filter(([, v]) => v && v.trim())
    .map(([label, v]) => `- ${label}: ${v!.trim()}`)
    .join("\n");
}

export const strategyModule: PromptModule<StrategyModuleInput, StrategyOutput> = {
  key: "strategy",
  role: "content strategist",
  temperature: 0.3,
  system: SYSTEM,
  inputSchema: strategyInputSchema,
  outputSchema: strategyOutputSchema,
  selfCheck: SELF_CHECK,
  buildUser: (input) => {
    return `Bối cảnh chiến lược tháng:\n${labelledBlock(
      input,
    )}\n\nTrả về JSON đúng schema đã mô tả (5 tuần, KHÔNG sinh dailyPlan).`;
  },
  // Ratio normalization done HERE in code — never trust the LLM's percentages.
  normalize: (o) => {
    const contentRatio = normalizeRecordTo100(o.contentRatio);
    const weeklyThemes = o.weeklyThemes.map((w) => ({
      ...w,
      objectivesMix: normalizeRecordTo100(w.objectivesMix),
    }));
    return { ...o, contentRatio, weeklyThemes };
  },
};
