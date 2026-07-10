// D.8 Facebook Post Writer · key="post-writer" · temp 0.7
// Viết bài FB tiếng Việt tự nhiên từ idea + objective + persona + brandDna.
// hookStyle / ctaIntensity / format CHỈ từ HOOK_STYLES / CTA_INTENSITY / FORMATS (z.enum).

import { z } from "zod";
import type { PromptModule } from "@/lib/ai/run";
import { OBJECTIVES, HOOK_STYLES, CTA_INTENSITY, FORMATS } from "@/lib/constants";
import { sanitizeExternal } from "@/lib/ai/sanitize";

export const postWriterInputSchema = z.object({
  idea: z.string().min(1),
  objectiveKey: z.enum(OBJECTIVES),
  framework: z.string().optional(),
  template: z.string().optional(),
  tone: z.string().min(1),
  length: z.string().min(1),
  persona: z.record(z.string(), z.unknown()),
  brandDna: z.record(z.string(), z.unknown()),
  cta: z.string().optional(),
});

export type PostWriterInput = z.infer<typeof postWriterInputSchema>;

export const postWriterOutputSchema = z.object({
  hook: z.string().min(1),
  body: z.string().min(1),
  ending: z.string().min(1),
  hashtags: z.array(z.string()).max(8),
  imageSuggestion: z.string(),
  hookStyle: z.enum(HOOK_STYLES),
  ctaIntensity: z.enum(CTA_INTENSITY),
  format: z.enum(FORMATS),
  estimatedReadTime: z.string(),
});

export type PostWriterOutput = z.infer<typeof postWriterOutputSchema>;

const OBJ_LIST = OBJECTIVES.join(", ");
const HOOK_LIST = HOOK_STYLES.join(", ");
const CTA_LIST = CTA_INTENSITY.join(", ");
const FMT_LIST = FORMATS.join(", ");

const SELF_CHECK = `SELF-CHECK trước khi trả:
- "hook": 1–2 dòng, không trống.
- "body": tối thiểu 3 câu, viết liền mạch, KHÔNG dùng bullet/heading markdown.
- "hashtags": mảng ≤ 8 phần tử.
- "hookStyle" phải là một trong: ${HOOK_LIST}.
- "ctaIntensity" phải là một trong: ${CTA_LIST}.
- "format" phải là một trong: ${FMT_LIST}.
- KHÔNG bịa số liệu, phần trăm, hay dữ liệu thống kê không có trong input.
- Toàn bộ hook/body/ending là PLAIN TEXT, không dùng **, ##, hay markdown bất kỳ.`;

const FEW_SHOT = `VÍ DỤ (rút gọn — chỉ minh hoạ cấu trúc JSON):
{"hook":"90% trader bỏ lỡ điều này khi vào lệnh vàng.","body":"Tôi từng làm vậy. Sau 3 năm giao dịch XAUUSD, tôi nhận ra rằng không phải setup mà là tâm lý quyết định. Bài hôm nay chia sẻ 1 thói quen nhỏ giúp tôi giữ được kỷ luật.","ending":"Bạn có thói quen gì giúp giữ kỷ luật? Chia sẻ bên dưới nhé.","hashtags":["xauusd","giaodichvang","trading"],"imageSuggestion":"Ảnh biểu đồ XAUUSD rõ ràng, nền tối, highlight điểm vào lệnh","hookStyle":"curiosity","ctaIntensity":"soft","format":"text","estimatedReadTime":"2 phút"}`;

const SYSTEM = `Bạn là copywriter viết bài Facebook tiếng Việt tự nhiên, đúng objective và brand voice.
Objective hợp lệ: ${OBJ_LIST}.
HookStyle hợp lệ: ${HOOK_LIST}.
CtaIntensity hợp lệ: ${CTA_LIST}.
Format hợp lệ: ${FMT_LIST}.

Quy tắc bắt buộc:
1. Viết PLAIN TEXT — không dùng **, ##, *, hay bất kỳ markdown nào.
2. Không bịa con số hay số liệu thống kê không có trong input.
3. Nếu objective="conversion" mà không có offer trong input, dùng ctaIntensity="soft".
4. "body" phải có ít nhất 3 câu.
5. "hashtags" tối đa 8 phần tử.

${SELF_CHECK}

${FEW_SHOT}`;

function pick(rec: Record<string, unknown>, keys: string[]): string {
  return keys
    .map((k) => (typeof rec[k] === "string" ? (rec[k] as string) : null))
    .filter((v): v is string => !!v && v.trim().length > 0)
    .join(" | ");
}

export const postWriterModule: PromptModule<PostWriterInput, PostWriterOutput> = {
  key: "post-writer",
  role: "copywriter",
  temperature: 0.7,
  system: SYSTEM,
  inputSchema: postWriterInputSchema,
  outputSchema: postWriterOutputSchema,
  selfCheck: SELF_CHECK,
  buildUser: (input) => {
    const personaSummary = pick(input.persona, [
      "name",
      "pain",
      "falseBelief",
      "desire",
      "language",
    ]);
    const dnaSummary = pick(input.brandDna, [
      "positioning",
      "differentiationSharpened",
      "voiceTraits",
    ]);
    // idea & cta là free text người dùng nhập (có thể paste từ notes ngoài)
    // → wrap như DATA (injection guard). Enum/persona/brandDna nội bộ thì không cần.
    const ctaLine = input.cta
      ? `\n- CTA gợi ý: ${sanitizeExternal(input.cta, "paste")}`
      : "";
    const frameworkLine = input.framework
      ? `\n- Framework: ${input.framework}`
      : "";
    const templateLine = input.template
      ? `\n- Template: ${input.template}`
      : "";

    return `Viết bài Facebook theo thông tin sau:
- Ý tưởng: ${sanitizeExternal(input.idea, "paste")}
- Objective: ${input.objectiveKey}
- Giọng điệu: ${input.tone}
- Độ dài mục tiêu: ${input.length}${frameworkLine}${templateLine}${ctaLine}
- Persona: ${personaSummary || "(không có)"}
- Brand DNA: ${dnaSummary || "(không có)"}

Trả về JSON đúng schema.`;
  },
};
