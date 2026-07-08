// D.1 Brand DNA Analyzer · key="brand-dna" · temp 0.2
// Role: brand strategist chuẩn hóa lõi thương hiệu cá nhân.
// system = D.1 role + task + SELF-CHECK + few-shot. buildUser is a pure function of the
// validated input; extractedFileText is already sanitized (<<DATA>>) by the caller/route.

import { z } from "zod";
import { sanitizeExternal } from "@/lib/ai/sanitize";
import type { PromptModule } from "@/lib/ai/run";

// D.1 Failure rule: input < 2 trường → yêu cầu tối thiểu whoAmI + field.
export const brandDnaInputSchema = z.object({
  whoAmI: z.string().trim().min(1, "Cần whoAmI"),
  field: z.string().trim().min(1, "Cần field"),
  coreBeliefs: z.string().optional(),
  differentiation: z.string().optional(),
  personalStory: z.string().optional(),
  expertise: z.string().optional(),
  customerProfile: z.string().optional(),
  customerPain: z.string().optional(),
  customerMisunderstanding: z.string().optional(),
  marketEducationGoal: z.string().optional(),
  extractedFileText: z.string().optional(),
});

export type BrandDnaModuleInput = z.infer<typeof brandDnaInputSchema>;

export const brandDnaOutputSchema = z.object({
  positioning: z.string().min(1),
  threeWords: z.tuple([
    z.string().min(1),
    z.string().min(1),
    z.string().min(1),
  ]),
  differentiationSharpened: z.string(),
  voiceTraits: z.array(z.string()),
  suggestedEducationTopics: z.array(z.string()),
  gaps: z.array(z.string()),
  assumptions: z.array(z.string()),
});

export type BrandDnaOutput = z.infer<typeof brandDnaOutputSchema>;

const SELF_CHECK = `SELF-CHECK trước khi trả:
- "threeWords" ĐÚNG 3 phần tử, không rỗng.
- Trường input nào thiếu → đưa ghi chú vào "gaps"; KHÔNG bịa nội dung.
- "positioning" là 1 câu định vị súc tích, không rỗng.`;

const FEW_SHOT = `VÍ DỤ (rút gọn):
Input: whoAmI="chuyên gia trading vàng", field="giao dịch XAUUSD"
Output:
{"positioning":"Người dẫn đường giao dịch XAUUSD kỷ luật cho nhà đầu tư cá nhân","threeWords":["kỷ luật","minh bạch","thực chiến"],"differentiationSharpened":"Tập trung quản trị rủi ro thay vì phím lệnh","voiceTraits":["thẳng thắn","dựa dữ liệu"],"suggestedEducationTopics":["quản trị vốn","tâm lý giao dịch"],"gaps":[],"assumptions":[]}`;

const SYSTEM = `Bạn là brand strategist, nhiệm vụ chuẩn hóa lõi thương hiệu cá nhân thành định vị rõ ràng.
Từ các trường input, hãy tổng hợp: positioning (1 câu), threeWords (đúng 3 từ khóa thương hiệu),
differentiationSharpened, voiceTraits, suggestedEducationTopics, gaps (trường còn thiếu/mơ hồ),
assumptions (giả định khi thiếu dữ liệu).

${SELF_CHECK}

${FEW_SHOT}`;

function labelledBlock(input: BrandDnaModuleInput): string {
  const fields: [string, string | undefined][] = [
    ["Tôi là ai (whoAmI)", input.whoAmI],
    ["Lĩnh vực (field)", input.field],
    ["Niềm tin cốt lõi (coreBeliefs)", input.coreBeliefs],
    ["Điểm khác biệt (differentiation)", input.differentiation],
    ["Câu chuyện cá nhân (personalStory)", input.personalStory],
    ["Chuyên môn (expertise)", input.expertise],
    ["Chân dung khách hàng (customerProfile)", input.customerProfile],
    ["Nỗi đau khách hàng (customerPain)", input.customerPain],
    ["Hiểu lầm của khách hàng (customerMisunderstanding)", input.customerMisunderstanding],
    ["Mục tiêu giáo dục thị trường (marketEducationGoal)", input.marketEducationGoal],
  ];
  return fields
    .filter(([, v]) => v && v.trim())
    .map(([label, v]) => `- ${label}: ${v!.trim()}`)
    .join("\n");
}

export const brandDnaModule: PromptModule<BrandDnaModuleInput, BrandDnaOutput> = {
  key: "brand-dna",
  role: "brand strategist",
  temperature: 0.2,
  system: SYSTEM,
  inputSchema: brandDnaInputSchema,
  outputSchema: brandDnaOutputSchema,
  selfCheck: SELF_CHECK,
  buildUser: (input) => {
    let user = `Thông tin thương hiệu cá nhân:\n${labelledBlock(input)}`;
    if (input.extractedFileText && input.extractedFileText.trim()) {
      // External text is wrapped as DATA (injection guard) — never as instructions.
      user += `\n\nTài liệu bổ sung:\n${sanitizeExternal(
        input.extractedFileText,
        "upload",
      )}`;
    }
    user += `\n\nTrả về JSON đúng schema đã mô tả.`;
    return user;
  },
  // threeWords is a tuple → outputSchema already enforces exactly 3. No-op safety hook.
  normalize: (o) => o,
};
