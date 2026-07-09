// D.2 Audience/Persona Builder · key="audience" · temp 0.3
// Role: audience strategist deriving actionable personas from Brand DNA + goal.
// Inputs are internal (Brand DNA / goal already produced by our own modules) → no
// external <<DATA>> sanitize needed. system = role + task + SELF-CHECK + few-shot.

import { z } from "zod";
import type { PromptModule } from "@/lib/ai/run";

// Internal, already-structured brand core — keep loose so upstream shape can vary.
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

export const audienceInputSchema = z.object({
  brandDna: brandDnaShape,
  goal: goalShape,
  existingSegments: z.array(z.string()).optional(),
});

export type AudienceModuleInput = z.infer<typeof audienceInputSchema>;

const personaSchema = z.object({
  name: z.string().min(1),
  pain: z.string().min(1),
  falseBelief: z.string().min(1),
  fear: z.string().min(1),
  desire: z.string().min(1),
  language: z.string().min(1),
  contentAngle: z.string().min(1),
  cta: z.string().min(1),
  offer: z.string().min(1),
});

export const audienceOutputSchema = z.object({
  personas: z.array(personaSchema).min(2).max(4),
  assumptions: z.array(z.string()),
});

export type AudienceOutput = z.infer<typeof audienceOutputSchema>;

const SELF_CHECK = `SELF-CHECK trước khi trả:
- "personas" có TỪ 2 ĐẾN 4 phần tử; "name" giữa các persona KHÔNG trùng nhau.
- Mỗi persona đủ 9 trường (name, pain, falseBelief, fear, desire, language, contentAngle, cta, offer), không rỗng.
- Nếu thiếu targetAudience/mainOffer → SUY LUẬN hợp lý từ brand DNA + goal và ghi 1 dòng vào "assumptions"; KHÔNG bịa dữ liệu vô căn cứ.`;

const FEW_SHOT = `VÍ DỤ (rút gọn):
Input: brand="chuyên gia trading vàng XAUUSD, định vị kỷ luật", goal={name:"Bán khóa học",goalType:"conversion"}
Output:
{"personas":[{"name":"Nhà giao dịch mới cháy tài khoản","pain":"Thua lỗ liên tục vì vào lệnh cảm tính","falseBelief":"Cần tín hiệu chuẩn là sẽ thắng","fear":"Mất hết vốn tiết kiệm","desire":"Giao dịch có hệ thống, đều đặn","language":"đời thường, thẳng","contentAngle":"quản trị rủi ro trước lợi nhuận","cta":"Đăng ký học thử","offer":"Khóa nền tảng kỷ luật"},{"name":"Nhà đầu tư bận rộn","pain":"Không có thời gian canh bảng","falseBelief":"Phải nhìn chart cả ngày mới ăn","fear":"Bỏ lỡ cơ hội","desire":"Chiến lược ít lệnh, hiệu quả","language":"gọn, dữ liệu","contentAngle":"swing setup ít thời gian","cta":"Nhận lộ trình","offer":"Gói cố vấn 1-1"}],"assumptions":["Suy ra 2 phân khúc từ định vị kỷ luật vì goal thiếu targetAudience"]}`;

const SYSTEM = `Bạn là audience strategist. Từ lõi thương hiệu (Brand DNA) và mục tiêu (goal),
hãy dựng 2–4 persona khách hàng CÓ THỂ HÀNH ĐỘNG. Mỗi persona gồm: name, pain (nỗi đau),
falseBelief (niềm tin sai), fear (nỗi sợ), desire (khát khao), language (giọng/ngôn ngữ họ dùng),
contentAngle (góc nội dung chạm họ), cta (kêu gọi phù hợp), offer (offer khớp).
Trả thêm "assumptions" — các giả định khi input thiếu.

${SELF_CHECK}

${FEW_SHOT}`;

function labelledBlock(input: AudienceModuleInput): string {
  const d = input.brandDna;
  const g = input.goal;
  const fields: [string, string | undefined][] = [
    ["Tôi là ai (whoAmI)", d.whoAmI],
    ["Lĩnh vực (field)", d.field],
    ["Định vị (positioning)", d.positioning],
    ["Ba từ khóa (threeWords)", d.threeWords?.join(", ")],
    ["Khác biệt (differentiation)", d.differentiationSharpened],
    ["Giọng (voiceTraits)", d.voiceTraits?.join(", ")],
    ["Tóm tắt brand (summary)", d.summary],
    ["Tên mục tiêu (goal.name)", g.name],
    ["Loại mục tiêu (goal.goalType)", g.goalType],
    ["Đối tượng mục tiêu (targetAudience)", g.targetAudience],
    ["Offer chính (mainOffer)", g.mainOffer],
    ["Phân khúc sẵn có (existingSegments)", input.existingSegments?.join(", ")],
  ];
  return fields
    .filter(([, v]) => v && v.trim())
    .map(([label, v]) => `- ${label}: ${v!.trim()}`)
    .join("\n");
}

export const audienceModule: PromptModule<AudienceModuleInput, AudienceOutput> = {
  key: "audience",
  role: "audience strategist",
  temperature: 0.3,
  system: SYSTEM,
  inputSchema: audienceInputSchema,
  outputSchema: audienceOutputSchema,
  selfCheck: SELF_CHECK,
  buildUser: (input) => {
    return `Bối cảnh thương hiệu & mục tiêu:\n${labelledBlock(
      input,
    )}\n\nTrả về JSON đúng schema đã mô tả.`;
  },
  // No ratio to normalize; count/uniqueness enforced by schema + self-check.
  normalize: (o) => o,
};
