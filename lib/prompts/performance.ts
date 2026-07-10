// D.14 Performance Analyzer · key="performance" · temp 0.2
// Role: data analyst đọc số liệu Post + phân loại (objective/pillar/hook/cta/format) và rút
// insight CÓ BẰNG CHỨNG trỏ về số liệu THẬT trong input. Không bịa số.
// Output enum (scope/confidence) đến TỪ z.enum trong module này — LLM không tự đặt.
// LƯU Ý: runModule KHÔNG sanitize trung tâm → buildUser TỰ bọc external text qua
// sanitizeExternal(text, "paste") (bài học M7, mirror brand-dna.ts).

import { z } from "zod";
import { sanitizeExternal } from "@/lib/ai/sanitize";
import type { PromptModule } from "@/lib/ai/run";

// metrics: giữ number nhưng cho phép nullable/optional an toàn (dữ liệu manual có thể thiếu).
const metricsShape = z.object({
  reach: z.number().nullable().optional(),
  engagement: z.number().nullable().optional(),
  comments: z.number().nullable().optional(),
  saves: z.number().nullable().optional(),
  daysSincePost: z.number().nullable().optional(),
});

// objective/pillar/hookStyle/ctaIntensity/format là DỮ LIỆU mô tả để phân tích, KHÔNG phải
// output enum → không dùng z.enum ở input.
const postShape = z.object({
  id: z.string(),
  objective: z.string(),
  pillar: z.string(),
  hookStyle: z.string(),
  ctaIntensity: z.string(),
  format: z.string(),
  metrics: metricsShape,
});

export const performanceInputSchema = z.object({
  posts: z.array(postShape),
  period: z.string(),
});

export type PerformanceModuleInput = z.infer<typeof performanceInputSchema>;

// Output enum values live HERE (z.enum) — never model-defined.
export const INSIGHT_SCOPES = [
  "post",
  "pillar",
  "hook",
  "cta",
  "format",
  "weekly",
] as const;
export const INSIGHT_CONFIDENCE = ["low", "normal"] as const;

const scopeEnum = z.enum(INSIGHT_SCOPES);
const confidenceEnum = z.enum(INSIGHT_CONFIDENCE);

const insightSchema = z.object({
  scope: scopeEnum,
  refId: z.string().optional(),
  finding: z.string().min(1),
  evidence: z.string().min(1),
  recommendation: z.string().min(1),
  confidence: confidenceEnum,
});

export const performanceOutputSchema = z.object({
  insights: z.array(insightSchema),
  topPosts: z.array(z.string()),
  weakPillars: z.array(z.string()),
  warnings: z.array(z.string()),
});

export type PerformanceOutput = z.infer<typeof performanceOutputSchema>;

// Rule "<3 bài → confidence=low" ép Ở CODE (không tin LLM). Gọi ở server action (T4) sau khi
// runModule trả ok, nơi biết postCount thật. Pure → test được (T7d).
export function enforceLowConfidence(
  out: PerformanceOutput,
  postCount: number,
): PerformanceOutput {
  if (postCount >= 3) return out;
  return {
    ...out,
    insights: out.insights.map((ins) => ({ ...ins, confidence: "low" as const })),
  };
}

const SCOPE_LIST = INSIGHT_SCOPES.join(", ");
const CONFIDENCE_LIST = INSIGHT_CONFIDENCE.join(", ");

const SELF_CHECK = `SELF-CHECK trước khi trả:
- Mỗi "finding" PHẢI có "evidence" trỏ tới CON SỐ THẬT trong input (vd: reach=1200, saves=8, daysSincePost=3). TUYỆT ĐỐI không bịa số không có trong dữ liệu.
- "scope" chỉ dùng đúng các giá trị: ${SCOPE_LIST}. "confidence" chỉ dùng: ${CONFIDENCE_LIST}.
- "refId" (nếu có) tham chiếu post.id có thật hoặc tên pillar/hook/cta/format có trong input.
- Nếu tổng số bài < 3 → đặt "confidence"="low" cho MỌI insight và thêm cảnh báo dữ liệu mỏng vào "warnings".
- "topPosts"/"weakPillars" chỉ chứa id/tên có mặt trong input.`;

const FEW_SHOT = `VÍ DỤ (rút gọn):
Input: posts=[{id:"p1",pillar:"Bằng chứng thực chiến",format:"carousel",metrics:{reach:1200,engagement:180,saves:24,daysSincePost:5}},{id:"p2",pillar:"Bằng chứng thực chiến",format:"text",metrics:{reach:800,engagement:40,saves:3,daysSincePost:6}}], period="Tuần 1"
Output:
{"insights":[{"scope":"format","refId":"carousel","finding":"Carousel giữ chân tốt hơn text","evidence":"p1 (carousel) saves=24 vs p2 (text) saves=3; engagement 180 vs 40","recommendation":"Ưu tiên carousel cho pillar Bằng chứng thực chiến","confidence":"low"}],"topPosts":["p1"],"weakPillars":[],"warnings":["Chỉ có 2 bài (<3) — độ tin cậy thấp, cần thêm dữ liệu"]}`;

const SYSTEM = `Bạn là data analyst phân tích hiệu suất nội dung mạng xã hội.
Từ danh sách bài đăng (đã gắn objective, pillar, hookStyle, ctaIntensity, format và số liệu
reach/engagement/comments/saves/daysSincePost), hãy rút ra "insights" theo từng "scope"
(${SCOPE_LIST}). Mỗi insight gồm: scope, refId (tùy chọn), finding, evidence (TRỎ SỐ LIỆU THẬT),
recommendation, confidence (${CONFIDENCE_LIST}).
Trả thêm: "topPosts" (id các bài nổi bật), "weakPillars" (tên pillar yếu), "warnings"
(cảnh báo dữ liệu mỏng/thiếu/bất thường).
Chỉ phân tích trên số liệu được cung cấp — KHÔNG suy diễn số không tồn tại.

${SELF_CHECK}

${FEW_SHOT}`;

function fmtMetric(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : String(v);
}

function postsBlock(input: PerformanceModuleInput): string {
  return input.posts
    .map((p) => {
      const m = p.metrics;
      // Free-text mô tả (objective/pillar/hook/cta/format) là external → bọc DATA.
      const labels = sanitizeExternal(
        `objective=${p.objective}, pillar=${p.pillar}, hookStyle=${p.hookStyle}, ctaIntensity=${p.ctaIntensity}, format=${p.format}`,
        "paste",
      );
      return (
        `- id=${p.id} | reach=${fmtMetric(m.reach)}, engagement=${fmtMetric(
          m.engagement,
        )}, comments=${fmtMetric(m.comments)}, saves=${fmtMetric(
          m.saves,
        )}, daysSincePost=${fmtMetric(m.daysSincePost)}\n` +
        `  phân loại: ${labels}`
      );
    })
    .join("\n");
}

export const performanceModule: PromptModule<
  PerformanceModuleInput,
  PerformanceOutput
> = {
  key: "performance",
  role: "data analyst",
  temperature: 0.2,
  system: SYSTEM,
  inputSchema: performanceInputSchema,
  outputSchema: performanceOutputSchema,
  selfCheck: SELF_CHECK,
  buildUser: (input) => {
    // period cũng là free-text từ user → bọc DATA (injection guard).
    const period = sanitizeExternal(input.period, "paste");
    return (
      `Kỳ phân tích (period): ${period}\n` +
      `Số bài: ${input.posts.length}\n\n` +
      `Danh sách bài đăng:\n${postsBlock(input)}\n\n` +
      `Trả về JSON đúng schema đã mô tả.`
    );
  },
  // normalize signature là (o:O)=>O — KHÔNG có input, nên KHÔNG thể biết posts.length ở đây.
  // → Chỉ chuẩn hóa an toàn: đảm bảo mọi insight có confidence hợp lệ, default "normal" nếu thiếu.
  // Rule "<3 posts → confidence=low" ĐƯỢC ÉP Ở TẦNG SERVER ACTION (M8-T4) nơi biết posts.length,
  // sau khi runModule trả về ok. KHÔNG enforce ở đây vì thiếu input.
  normalize: (o) => {
    const insights = o.insights.map((ins) => ({
      ...ins,
      confidence: INSIGHT_CONFIDENCE.includes(ins.confidence)
        ? ins.confidence
        : ("normal" as (typeof INSIGHT_CONFIDENCE)[number]),
    }));
    return { ...o, insights };
  },
};
