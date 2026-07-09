// D.7 Content Idea Generator · key="content-idea" · temp 0.5 — PROMPT-ONLY (không route).
// Sinh 1..5 ý tưởng bài viết từ 1 dailyPlan + pillar + persona + brandDna.
// objectiveKey CHỈ lấy từ OBJECTIVES (z.enum). Không có ratio → KHÔNG normalize.

import { z } from "zod";
import type { PromptModule } from "@/lib/ai/run";
import { OBJECTIVES } from "@/lib/constants";

export const contentIdeaInputSchema = z.object({
  dailyPlan: z.record(z.string(), z.unknown()),
  pillar: z.record(z.string(), z.unknown()),
  persona: z.record(z.string(), z.unknown()),
  brandDna: z.record(z.string(), z.unknown()),
});

export type ContentIdeaModuleInput = z.infer<typeof contentIdeaInputSchema>;

const ideaSchema = z.object({
  title: z.string().min(1),
  angle: z.string().min(1),
  hookSeed: z.string().min(1),
  objectiveKey: z.enum(OBJECTIVES),
});

export const contentIdeaOutputSchema = z.object({
  ideas: z.array(ideaSchema).min(1, "Cần ít nhất 1 ý tưởng").max(5, "Tối đa 5 ý tưởng"),
});

export type ContentIdeaOutput = z.infer<typeof contentIdeaOutputSchema>;

const OBJ_LIST = OBJECTIVES.join(", ");

const SELF_CHECK = `SELF-CHECK trước khi trả:
- "ideas" có TỪ 1 ĐẾN 5 phần tử.
- Mỗi "objectiveKey" PHẢI là một trong ĐÚNG các giá trị: ${OBJ_LIST}. KHÔNG dùng giá trị khác.
- Mỗi ý tưởng bám vào pillar, persona và mục tiêu của dailyPlan.`;

const FEW_SHOT = `VÍ DỤ (rút gọn):
Output:
{"ideas":[{"title":"Sai lầm cắt lỗ khiến bạn cháy tài khoản","angle":"Phân tích 3 tình huống thực tế","hookSeed":"90% người mới cháy tài khoản vì lỗi này","objectiveKey":"educate"},{"title":"Nhật ký lệnh minh bạch tuần qua","angle":"Khoe cả lệnh thắng lẫn thua","hookSeed":"Tôi công khai cả lệnh thua","objectiveKey":"trust"}]}`;

const SYSTEM = `Bạn là biên tập nội dung. Từ một kế hoạch ngày (dailyPlan), pillar, persona và Brand DNA,
hãy đề xuất TỪ 1 ĐẾN 5 ý tưởng bài viết. Mỗi ý tưởng gồm:
- "title": tiêu đề ngắn.
- "angle": góc tiếp cận.
- "hookSeed": mầm hook (câu mở đầu gợi ý).
- "objectiveKey": một trong ${OBJ_LIST}, khớp mục tiêu của dailyPlan.

${SELF_CHECK}

${FEW_SHOT}`;

function pick(rec: Record<string, unknown>, keys: string[]): string {
  return keys
    .map((k) => (typeof rec[k] === "string" ? (rec[k] as string) : null))
    .filter((v): v is string => !!v && v.trim().length > 0)
    .join(" | ");
}

function labelledBlock(input: ContentIdeaModuleInput): string {
  const fields: [string, string][] = [
    ["Kế hoạch ngày (objective/topic/cta)", pick(input.dailyPlan, ["objective", "suggestedTopic", "suggestedCta", "pillar"])],
    ["Pillar", pick(input.pillar, ["name", "description"])],
    ["Persona", pick(input.persona, ["name", "painPoints", "desires", "summary"])],
    ["Brand DNA", pick(input.brandDna, ["positioning", "differentiationSharpened", "field"])],
  ];
  return fields
    .filter(([, v]) => v && v.trim())
    .map(([label, v]) => `- ${label}: ${v}`)
    .join("\n");
}

export const contentIdeaModule: PromptModule<ContentIdeaModuleInput, ContentIdeaOutput> = {
  key: "content-idea",
  role: "content editor",
  temperature: 0.5,
  system: SYSTEM,
  inputSchema: contentIdeaInputSchema,
  outputSchema: contentIdeaOutputSchema,
  selfCheck: SELF_CHECK,
  buildUser: (input) => {
    return `Bối cảnh sinh ý tưởng:\n${labelledBlock(
      input,
    )}\n\nTrả về JSON đúng schema (1..5 ý tưởng).`;
  },
  // Không có ratio → không normalize.
};
