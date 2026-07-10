// D.11 Tone Rewriter · key="tone" · temp 0.5
// Viết lại văn bản theo giọng điệu mục tiêu, giữ ý chính và CTA nếu có.

import { z } from "zod";
import type { PromptModule } from "@/lib/ai/run";
import { sanitizeExternal } from "@/lib/ai/sanitize";

export const toneInputSchema = z.object({
  text: z.string().min(1),
  targetTone: z.string().min(1),
});

export type ToneInput = z.infer<typeof toneInputSchema>;

export const toneOutputSchema = z.object({
  rewritten: z.string().min(1),
  changesSummary: z.string().min(1),
});

export type ToneOutput = z.infer<typeof toneOutputSchema>;

const SELF_CHECK = `SELF-CHECK trước khi trả:
- "rewritten" không trống, giữ toàn bộ ý chính của bản gốc.
- Nếu bản gốc có CTA (kêu gọi hành động), CTA phải xuất hiện trong "rewritten".
- "changesSummary" mô tả ngắn gọn những gì đã thay đổi về giọng điệu.
- Bản viết lại là PLAIN TEXT, không dùng markdown.`;

const FEW_SHOT = `VÍ DỤ (rút gọn):
Input text: "Hôm nay tôi share một vài kinh nghiệm về XAUUSD. Các bạn chú ý nhé."
targetTone: "thẳng thắn, dứt khoát"
Output: {"rewritten":"XAUUSD hôm nay có 3 điểm cần biết. Đọc ngay trước khi vào lệnh.","changesSummary":"Bỏ 'share', 'các bạn'; dùng câu ngắn dứt khoát; thêm urgency."}`;

const SYSTEM = `Bạn là editor viết lại bài Facebook tiếng Việt theo giọng điệu mục tiêu.

Quy tắc:
1. Giữ TOÀN BỘ ý chính — không thêm thông tin mới, không bỏ bớt ý.
2. Giữ CTA (kêu gọi hành động) nếu có trong bản gốc.
3. Viết lại bằng PLAIN TEXT, không dùng markdown.
4. "changesSummary" ngắn gọn, liệt kê điểm đã thay đổi về giọng điệu.

${SELF_CHECK}

${FEW_SHOT}`;

export const toneModule: PromptModule<ToneInput, ToneOutput> = {
  key: "tone",
  role: "editor",
  temperature: 0.5,
  system: SYSTEM,
  inputSchema: toneInputSchema,
  outputSchema: toneOutputSchema,
  selfCheck: SELF_CHECK,
  buildUser: (input) => {
    // Bản gốc là nội dung user paste (dữ liệu ngoài) → wrap như DATA (injection guard).
    return `Viết lại đoạn văn sau theo giọng điệu: "${input.targetTone}"

Bản gốc:
${sanitizeExternal(input.text, "paste")}

Trả về JSON đúng schema với "rewritten" và "changesSummary".`;
  },
};
