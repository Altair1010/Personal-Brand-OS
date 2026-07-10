// D.15 Revision Engine · key="revision" · temp 0.3
// Role: strategist đọc insight + attribution theo version (versionPerf) rồi đề xuất điều chỉnh
// chiến lược cho tuần kế. Mọi đổi hướng PHẢI có "reasonForNewVersion" (non-empty, ép ở schema).
// Ratio normalize về 100 Ở CODE (normalizeRecordTo100), không tin LLM.
// LƯU Ý: runModule KHÔNG sanitize trung tâm → buildUser TỰ bọc external text qua
// sanitizeExternal(text, "paste") (bài học M7, mirror performance.ts/brand-dna.ts).

import { z } from "zod";
import { sanitizeExternal } from "@/lib/ai/sanitize";
import { normalizeRecordTo100 } from "@/lib/strategy-engine/normalizeRatio";
import type { PromptModule } from "@/lib/ai/run";

// weeklyThemes chỉ để model tham chiếu → shape lỏng.
const currentStrategyVersionShape = z.object({
  version: z.number(),
  contentRatio: z.record(z.string(), z.number()),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  weeklyThemes: z.array(z.any()),
});

const insightShape = z.object({
  scope: z.string(),
  finding: z.string(),
  evidence: z.string(),
  recommendation: z.string(),
  confidence: z.string(),
});

const versionPerfShape = z.object({
  version: z.number(),
  postCount: z.number(),
  avgReach: z.number(),
  avgEngagement: z.number(),
});

export const revisionInputSchema = z.object({
  currentStrategyVersion: currentStrategyVersionShape,
  insights: z.array(insightShape),
  versionPerf: z.array(versionPerfShape),
  goal: z.object({
    name: z.string(),
    description: z.string().optional(),
  }),
  weekNumber: z.number(),
});

export type RevisionInput = z.infer<typeof revisionInputSchema>;

export const revisionOutputSchema = z.object({
  weeklyInsight: z.string().min(1),
  adjustmentPlan: z
    .array(
      z.object({
        change: z.string().min(1),
        reason: z.string().min(1),
      }),
    )
    .min(1),
  nextWeekDirection: z.string().min(1),
  newExperiments: z.array(z.string()),
  warnings: z.array(z.string()),
  revisedContentRatio: z.record(z.string(), z.number()),
  // BẮT BUỘC non-empty — mọi đổi hướng phải ghi lý do (StrategyVersion.reason non-null).
  reasonForNewVersion: z.string().min(1),
});

export type RevisionOutput = z.infer<typeof revisionOutputSchema>;

const SELF_CHECK = `SELF-CHECK trước khi trả:
- "reasonForNewVersion" TUYỆT ĐỐI không rỗng — mọi lần chốt version đều phải ghi lý do.
- Tổng "revisedContentRatio" phải = 100 (code sẽ chuẩn hóa lại, nhưng vẫn cố cho đúng).
- "revisedContentRatio" CHỈ dùng đúng các key pillar có trong currentStrategyVersion.contentRatio — không thêm/bớt key.
- Chỉ dùng SỐ LIỆU THẬT trong input (versionPerf, insights) — KHÔNG bịa số.
- Nếu THIẾU DỮ LIỆU (insights rỗng, hoặc versionPerf rỗng, hoặc tổng postCount < 3):
  đặt "adjustmentPlan"=[{"change":"giữ nguyên chiến lược","reason":"chưa đủ dữ liệu để điều chỉnh"}],
  giữ nguyên "revisedContentRatio" = contentRatio hiện tại, NHƯNG VẪN điền "reasonForNewVersion"
  (vd "Chốt version tuần N — dữ liệu chưa đủ, giữ hướng và thu thêm").`;

const FEW_SHOT = `VÍ DỤ (rút gọn):
Input: currentStrategyVersion.contentRatio={"Bằng chứng thực chiến":50,"Giáo dục":50}, versionPerf=[{version:1,postCount:6,avgReach:1000,avgEngagement:120}], insights=[{scope:"pillar",finding:"pillar Bằng chứng thực chiến engagement cao hơn","evidence":"avgEngagement 120","recommendation":"tăng tỉ trọng","confidence":"normal"}], weekNumber=2
Output:
{"weeklyInsight":"Pillar Bằng chứng thực chiến kéo tương tác tốt hơn Giáo dục","adjustmentPlan":[{"change":"Tăng tỉ trọng Bằng chứng thực chiến lên 60%","reason":"insight cho thấy engagement cao hơn (avgEngagement=120)"}],"nextWeekDirection":"Đẩy mạnh case study thực chiến, giữ 1 bài giáo dục nền tảng","newExperiments":["Thử format carousel cho case study"],"warnings":[],"revisedContentRatio":{"Bằng chứng thực chiến":60,"Giáo dục":40},"reasonForNewVersion":"Tuần 2: dồn tỉ trọng sang pillar có engagement cao hơn theo dữ liệu version 1"}`;

const SYSTEM = `Bạn là strategist điều chỉnh chiến lược nội dung theo tuần cho một thương hiệu cá nhân.
Đầu vào gồm: version chiến lược hiện tại (contentRatio + weeklyThemes), danh sách insight từ
Performance Analyzer, bảng attribution theo version (versionPerf: postCount/avgReach/avgEngagement
để so sánh version nào tốt hơn), goal, và số tuần (weekNumber).
Nhiệm vụ: rút "weeklyInsight", đề "adjustmentPlan" (mỗi mục: change + reason), "nextWeekDirection",
"newExperiments", "warnings", "revisedContentRatio" (điều chỉnh tỉ trọng pillar), và
"reasonForNewVersion" (lý do chốt version mới — BẮT BUỘC).
Chỉ dựa trên số liệu được cung cấp — KHÔNG suy diễn số không tồn tại.

${SELF_CHECK}

${FEW_SHOT}`;

function ratioBlock(record: Record<string, number>): string {
  const entries = Object.entries(record);
  if (entries.length === 0) return "(trống)";
  return entries.map(([k, v]) => `  - ${k}: ${v}`).join("\n");
}

function insightsBlock(input: RevisionInput): string {
  if (input.insights.length === 0) return "(không có insight)";
  return input.insights
    .map((ins, i) => {
      // finding/evidence/recommendation là free-text external → bọc DATA (injection guard).
      const finding = sanitizeExternal(ins.finding, "paste");
      const evidence = sanitizeExternal(ins.evidence, "paste");
      const recommendation = sanitizeExternal(ins.recommendation, "paste");
      return (
        `- [${i + 1}] scope=${ins.scope}, confidence=${ins.confidence}\n` +
        `  finding: ${finding}\n` +
        `  evidence: ${evidence}\n` +
        `  recommendation: ${recommendation}`
      );
    })
    .join("\n");
}

function versionPerfBlock(input: RevisionInput): string {
  if (input.versionPerf.length === 0) return "(chưa có dữ liệu attribution)";
  return input.versionPerf
    .map(
      (v) =>
        `- version ${v.version}: postCount=${v.postCount}, avgReach=${v.avgReach}, avgEngagement=${v.avgEngagement}`,
    )
    .join("\n");
}

function themesBlock(input: RevisionInput): string {
  const themes = input.currentStrategyVersion.weeklyThemes;
  if (!Array.isArray(themes) || themes.length === 0) return "(không có)";
  // weeklyThemes có thể chứa free-text → serialize + bọc DATA.
  return sanitizeExternal(JSON.stringify(themes), "paste");
}

export const revisionModule: PromptModule<RevisionInput, RevisionOutput> = {
  key: "revision",
  role: "strategist",
  temperature: 0.3,
  system: SYSTEM,
  inputSchema: revisionInputSchema,
  outputSchema: revisionOutputSchema,
  selfCheck: SELF_CHECK,
  buildUser: (input) => {
    // goal.name / goal.description là free-text external → bọc DATA.
    const goalName = sanitizeExternal(input.goal.name, "paste");
    const goalDesc = input.goal.description
      ? sanitizeExternal(input.goal.description, "paste")
      : "(không có)";
    return (
      `Tuần (weekNumber): ${input.weekNumber}\n` +
      `Goal: ${goalName}\n` +
      `Mô tả goal: ${goalDesc}\n\n` +
      `Version hiện tại: v${input.currentStrategyVersion.version}\n` +
      `contentRatio hiện tại:\n${ratioBlock(input.currentStrategyVersion.contentRatio)}\n` +
      `weeklyThemes: ${themesBlock(input)}\n\n` +
      `Insights (${input.insights.length}):\n${insightsBlock(input)}\n\n` +
      `Attribution theo version (versionPerf):\n${versionPerfBlock(input)}\n\n` +
      `Trả về JSON đúng schema.`
    );
  },
  // Ratio normalize về đúng tổng 100 Ở CODE (largest-remainder) — không tin LLM.
  normalize: (o) => ({
    ...o,
    revisedContentRatio: normalizeRecordTo100(o.revisedContentRatio),
  }),
};
