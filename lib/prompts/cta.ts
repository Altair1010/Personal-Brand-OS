// D.10 CTA Generator · key="cta" · temp 0.7
// Sinh danh sách CTA phù hợp objective + intensity.
// intensity CHỈ từ CTA_INTENSITY (z.enum). Không để LLM tự đặt enum.

import { z } from "zod";
import type { PromptModule } from "@/lib/ai/run";
import { OBJECTIVES, CTA_INTENSITY } from "@/lib/constants";
import { sanitizeExternal } from "@/lib/ai/sanitize";

export const ctaInputSchema = z.object({
  objectiveKey: z.enum(OBJECTIVES),
  goal: z.record(z.string(), z.unknown()),
  offer: z.string().optional(),
  intensity: z.enum(CTA_INTENSITY),
});

export type CtaInput = z.infer<typeof ctaInputSchema>;

const ctaItemSchema = z.object({
  text: z.string().min(1),
  intensity: z.enum(CTA_INTENSITY),
});

export const ctaOutputSchema = z.object({
  ctas: z
    .array(ctaItemSchema)
    .min(1, "Cần ít nhất 1 CTA")
    .max(10, "Tối đa 10 CTA"),
});

export type CtaOutput = z.infer<typeof ctaOutputSchema>;

const OBJ_LIST = OBJECTIVES.join(", ");
const CTA_LIST = CTA_INTENSITY.join(", ");

const SELF_CHECK = `SELF-CHECK trước khi trả:
- Mỗi "intensity" PHẢI là một trong: ${CTA_LIST}.
- Không trùng nội dung "text".
- CTA là PLAIN TEXT, không dùng markdown.
- Phù hợp objective và intensity yêu cầu.`;

const FEW_SHOT = `VÍ DỤ (rút gọn):
{"ctas":[{"text":"Comment 'học' để nhận tài liệu miễn phí nhé.","intensity":"soft"},{"text":"Nhắn tin cho tôi để được tư vấn cụ thể về tình huống của bạn.","intensity":"medium"},{"text":"Đăng ký khoá học ngay hôm nay — chỉ còn 5 suất.","intensity":"hard"}]}`;

const SYSTEM = `Bạn là copywriter viết CTA Facebook tiếng Việt.
Objective hợp lệ: ${OBJ_LIST}.
Intensity hợp lệ: ${CTA_LIST}.

Quy tắc:
1. Sinh 3–5 CTA, mix intensity khác nhau quanh mức yêu cầu.
2. Nếu có offer, đưa offer vào các CTA intensity="medium" hoặc "hard".
3. CTA phải PLAIN TEXT, hành động rõ ràng, tự nhiên tiếng Việt.
4. Không bịa thông tin không có trong input (giá, ngày hết hạn…).

${SELF_CHECK}

${FEW_SHOT}`;

export const ctaModule: PromptModule<CtaInput, CtaOutput> = {
  key: "cta",
  role: "copywriter",
  temperature: 0.7,
  system: SYSTEM,
  inputSchema: ctaInputSchema,
  outputSchema: ctaOutputSchema,
  selfCheck: SELF_CHECK,
  buildUser: (input) => {
    const goalDesc =
      typeof input.goal["mainGoal"] === "string"
        ? sanitizeExternal(input.goal["mainGoal"], "paste")
        : typeof input.goal["description"] === "string"
          ? sanitizeExternal(input.goal["description"], "paste")
          : sanitizeExternal(JSON.stringify(input.goal).slice(0, 200), "paste");
    const offerLine = input.offer
      ? `\n- Offer: ${sanitizeExternal(input.offer, "paste")}`
      : "";

    return `Sinh CTA cho thông tin sau:
- Objective: ${input.objectiveKey}
- Mức intensity yêu cầu: ${input.intensity}
- Goal: ${goalDesc}${offerLine}

Trả về JSON đúng schema với mảng "ctas".`;
  },
};
