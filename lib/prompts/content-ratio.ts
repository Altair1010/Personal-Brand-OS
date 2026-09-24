import { z } from "zod";
import type { PromptModule } from "@/lib/ai/run";
import { OBJECTIVES } from "@/lib/constants";
import { normalizeRecordTo100 } from "@/lib/strategy-engine/normalizeRatio";

const ratioSchema = z.object(
  Object.fromEntries(OBJECTIVES.map((key) => [key, z.number().min(0).max(100)])) as Record<
    (typeof OBJECTIVES)[number],
    z.ZodNumber
  >,
);

export const contentRatioInputSchema = z.object({
  brand: z.object({
    companyName: z.string().optional(),
    field: z.string().optional(),
    positioning: z.string().optional(),
    threeWords: z.array(z.string()).optional(),
    usp: z.string().optional(),
    region: z.string().optional(),
  }),
  objective: z.object({
    key: z.string(),
    label: z.string().optional(),
    name: z.string().optional(),
  }),
  kpis: z.array(
    z.object({
      metric: z.string(),
      target: z.string().optional(),
      unit: z.string().optional(),
    }),
  ).optional(),
  brandStage: z.string().optional(),
});

export const contentRatioOutputSchema = z.object({
  contentRatio: ratioSchema,
  rationale: z.string().min(1).max(1400),
  assumptions: z.array(z.string()).max(8),
});

export type ContentRatioOutput = z.infer<typeof contentRatioOutputSchema>;

const SYSTEM = `Bạn là chiến lược gia content marketing.
Nhiệm vụ: đề xuất tỷ trọng nội dung toàn tháng theo đúng 6 khóa: seo, educate, trust, conversion, story, community.

Nguyên tắc:
- Tổng tỷ trọng phải xấp xỉ 100; hệ thống sẽ chuẩn hóa chính xác trong code.
- Dùng Brand DNA, ngành, định vị, Objective, KPI và giai đoạn thương hiệu nếu có.
- Đề xuất phải có rationale ngắn, rõ logic chiến lược.
- Không biến mọi Objective thành conversion-heavy.
- Với thương hiệu y tế/chăm sóc sức khỏe, ưu tiên giáo dục chính xác, xây dựng niềm tin, trải nghiệm dịch vụ, sự an tâm và cộng đồng trước bán hàng trực diện.
- Với KHIẾT TÂM ĐƯỜNG, ưu tiên educate + trust + story/community để thể hiện trải nghiệm chăm sóc chỉn chu, chính trực, ấm áp; conversion nên tiết chế và không dùng cách bán hàng gây áp lực.
- Không đưa ra tuyên bố y khoa hoặc hiệu quả điều trị không có bằng chứng.

Trả JSON đúng schema: {contentRatio, rationale, assumptions}.`;

export const contentRatioModule: PromptModule<
  z.infer<typeof contentRatioInputSchema>,
  ContentRatioOutput
> = {
  key: "content-ratio",
  role: "content allocation strategist",
  temperature: 0.2,
  system: SYSTEM,
  inputSchema: contentRatioInputSchema,
  outputSchema: contentRatioOutputSchema,
  buildUser: (input) =>
    `Bối cảnh phân bổ nội dung:\n${JSON.stringify(input, null, 2)}\n\nĐề xuất tỷ trọng 6 nhóm nội dung và giải thích ngắn.`,
  normalize: (output) => ({
    ...output,
    contentRatio: normalizeRecordTo100(output.contentRatio),
  }),
};
