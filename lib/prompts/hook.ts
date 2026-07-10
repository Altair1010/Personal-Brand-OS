// D.9 Hook Generator · key="hook" · temp 0.7
// Sinh danh sách hook đa dạng từ topic + objective + persona.
// style CHỈ từ HOOK_STYLES (z.enum). count clamp ở code, không để LLM quyết.

import { z } from "zod";
import type { PromptModule } from "@/lib/ai/run";
import { OBJECTIVES, HOOK_STYLES } from "@/lib/constants";

export const hookInputSchema = z.object({
  topic: z.string().min(1),
  objectiveKey: z.enum(OBJECTIVES),
  persona: z.record(z.string(), z.unknown()),
  count: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(5)
    .transform((n) => Math.min(Math.max(n, 1), 10)),
});

export type HookInput = z.infer<typeof hookInputSchema>;

const hookItemSchema = z.object({
  text: z.string().min(1),
  style: z.enum(HOOK_STYLES),
});

export const hookOutputSchema = z.object({
  hooks: z
    .array(hookItemSchema)
    .min(1, "Cần ít nhất 1 hook")
    .max(10, "Tối đa 10 hook"),
});

export type HookOutput = z.infer<typeof hookOutputSchema>;

const OBJ_LIST = OBJECTIVES.join(", ");
const HOOK_LIST = HOOK_STYLES.join(", ");

const SELF_CHECK = `SELF-CHECK trước khi trả:
- Số hook bằng đúng "count" được yêu cầu (1–10).
- Mỗi "style" phải là một trong: ${HOOK_LIST}.
- Không có 2 hook trùng nội dung "text".
- Hook phải PLAIN TEXT, không markdown.`;

const FEW_SHOT = `VÍ DỤ (rút gọn):
{"hooks":[{"text":"90% trader bỏ lỗi này khi vào lệnh vàng.","style":"curiosity"},{"text":"Tôi đã cháy tài khoản 3 lần trước khi hiểu điều này.","style":"story"},{"text":"Đừng vào lệnh XAUUSD nếu chưa biết điều này.","style":"contrarian"}]}`;

const SYSTEM = `Bạn là copywriter sinh hook Facebook tiếng Việt.
Objective hợp lệ: ${OBJ_LIST}.
Style hợp lệ: ${HOOK_LIST}.

Quy tắc:
1. Sinh đúng số hook theo "count".
2. Mỗi hook dùng style khác nhau nếu có thể — không trùng text.
3. Hook phải PLAIN TEXT, ngắn gọn (1–2 dòng), kéo người đọc dừng lại.
4. Bám sát topic và đặc điểm persona.

${SELF_CHECK}

${FEW_SHOT}`;

export const hookModule: PromptModule<HookInput, HookOutput> = {
  key: "hook",
  role: "copywriter",
  temperature: 0.7,
  system: SYSTEM,
  inputSchema: hookInputSchema,
  outputSchema: hookOutputSchema,
  selfCheck: SELF_CHECK,
  buildUser: (input) => {
    const personaDesc =
      typeof input.persona["pain"] === "string"
        ? `Nỗi đau: ${input.persona["pain"]}`
        : typeof input.persona["name"] === "string"
          ? `Persona: ${input.persona["name"]}`
          : "";

    return `Sinh ${input.count} hook cho chủ đề sau:
- Topic: ${input.topic}
- Objective: ${input.objectiveKey}
${personaDesc ? `- ${personaDesc}` : ""}

Trả về JSON đúng schema với mảng "hooks" gồm ${input.count} phần tử.`;
  },
};
