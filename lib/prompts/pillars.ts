// D.3 Content Pillar Builder · key="pillars" · temp 0.2
// Role: content strategist deriving 3–5 pillars with objective mix from DNA + goal + personas.
// Enum keys of objectiveMix come ONLY from OBJECTIVES (lib/constants). Ratios are re-normalized
// to 100 IN CODE (normalize hook) — the LLM's percentages are never trusted.

import { z } from "zod";
import type { PromptModule } from "@/lib/ai/run";
import { OBJECTIVES } from "@/lib/constants";
import {
  normalizeRatioTo100,
  normalizeRecordTo100,
} from "@/lib/strategy-engine/normalizeRatio";

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

export const pillarsInputSchema = z.object({
  brandDna: brandDnaShape,
  goal: goalShape,
  personas: z.array(z.record(z.string(), z.unknown())).min(1, "Cần ít nhất 1 persona"),
});

export type PillarsModuleInput = z.infer<typeof pillarsInputSchema>;

// objectiveMix keys are EXACTLY the 6 OBJECTIVES — built from constants, never model-defined.
const objectiveMixSchema = z.object(
  Object.fromEntries(OBJECTIVES.map((k) => [k, z.number()])) as Record<
    (typeof OBJECTIVES)[number],
    z.ZodNumber
  >,
);

export type ObjectiveMix = z.infer<typeof objectiveMixSchema>;

const pillarSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  ratioPercent: z.number(),
  objectiveMix: objectiveMixSchema,
});

export const pillarsOutputSchema = z.object({
  pillars: z.array(pillarSchema).min(3).max(5),
  rationale: z.string().min(1),
  assumptions: z.array(z.string()),
});

export type PillarsOutput = z.infer<typeof pillarsOutputSchema>;

const OBJ_LIST = OBJECTIVES.join(", ");

const SELF_CHECK = `SELF-CHECK trước khi trả:
- "pillars" có TỪ 3 ĐẾN 5 phần tử; "name" không trùng.
- "ratioPercent" của các pillar CỐ GẮNG cộng lại = 100 (hệ thống sẽ tự chuẩn hóa lại về 100).
- Mỗi "objectiveMix" dùng ĐÚNG 6 khóa: ${OBJ_LIST}; giá trị cộng ≈ 100 (hệ thống sẽ tự chuẩn hóa lại).
- KHÔNG thêm/đổi tên khóa objectiveMix ngoài 6 giá trị trên.`;

const FEW_SHOT = `VÍ DỤ (rút gọn):
Output:
{"pillars":[{"name":"Giáo dục quản trị rủi ro","description":"Dạy quản trị vốn & tâm lý","ratioPercent":40,"objectiveMix":{"seo":10,"educate":50,"trust":20,"conversion":5,"story":5,"community":10}},{"name":"Bằng chứng thực chiến","description":"Nhật ký lệnh minh bạch","ratioPercent":35,"objectiveMix":{"seo":5,"educate":20,"trust":45,"conversion":10,"story":15,"community":5}},{"name":"Chuyển đổi khóa học","description":"Lộ trình & lời mời","ratioPercent":25,"objectiveMix":{"seo":5,"educate":15,"trust":15,"conversion":50,"story":10,"community":5}}],"rationale":"Cân bằng giáo dục dẫn dắt, bằng chứng tạo niềm tin, rồi chuyển đổi","assumptions":[]}`;

const SYSTEM = `Bạn là content strategist. Từ Brand DNA, mục tiêu (goal) và personas,
hãy đề xuất 3–5 content pillar. Mỗi pillar gồm: name, description, ratioPercent (tỷ trọng nội dung),
và objectiveMix — phân bổ theo ĐÚNG 6 mục tiêu: ${OBJ_LIST}.
Trả thêm "rationale" (lý do bố cục) và "assumptions" (giả định khi thiếu dữ liệu).

${SELF_CHECK}

${FEW_SHOT}`;

function labelledBlock(input: PillarsModuleInput): string {
  const d = input.brandDna;
  const g = input.goal;
  const personaNames = input.personas
    .map((p) => (typeof p.name === "string" ? p.name : null))
    .filter((n): n is string => !!n);
  const fields: [string, string | undefined][] = [
    ["Định vị (positioning)", d.positioning],
    ["Lĩnh vực (field)", d.field],
    ["Ba từ khóa (threeWords)", d.threeWords?.join(", ")],
    ["Khác biệt (differentiation)", d.differentiationSharpened],
    ["Tên mục tiêu (goal.name)", g.name],
    ["Loại mục tiêu (goal.goalType)", g.goalType],
    ["Offer chính (mainOffer)", g.mainOffer],
    ["Personas", personaNames.join("; ")],
  ];
  return fields
    .filter(([, v]) => v && v.trim())
    .map(([label, v]) => `- ${label}: ${v!.trim()}`)
    .join("\n");
}

export const pillarsModule: PromptModule<PillarsModuleInput, PillarsOutput> = {
  key: "pillars",
  role: "content strategist",
  temperature: 0.2,
  system: SYSTEM,
  inputSchema: pillarsInputSchema,
  outputSchema: pillarsOutputSchema,
  selfCheck: SELF_CHECK,
  buildUser: (input) => {
    return `Bối cảnh chiến lược nội dung:\n${labelledBlock(
      input,
    )}\n\nTrả về JSON đúng schema đã mô tả.`;
  },
  // Ratio normalization is done HERE in code — never trust the LLM's percentages.
  normalize: (o) => {
    const pillars = normalizeRatioTo100(o.pillars, "ratioPercent").map((p) => ({
      ...p,
      objectiveMix: normalizeRecordTo100(p.objectiveMix),
    }));
    return { ...o, pillars };
  },
};
