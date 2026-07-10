// M9 Revision Engine — cảnh báo dựa TRÊN LUẬT (không AI, không I/O DB).
// Chạy cùng warnings của module revision để gộp lại ở action.
// Nhận PerfPost[] đã load (mirror Performance tab).

import { aggregate, type PerfPost } from "@/lib/performance-engine/aggregate";

// Ngưỡng luật — đặt tên rõ để chỉnh 1 chỗ.
const CONVERSION_HEAVY_RATIO = 0.4; // ≥40% bài là conversion → cảnh báo bán hàng
const WEAK_PILLAR_MEDIAN_FACTOR = 0.5; // pillar yếu = < 0.5 * trung vị avgEngagement

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function ruleWarnings(posts: PerfPost[]): string[] {
  if (posts.length === 0) return [];

  const warnings: string[] = [];

  // Luật 1 — quá bán hàng: tỉ lệ posts objectiveKey="conversion" ≥ ngưỡng.
  const conversionCount = posts.filter(
    (p) => p.objectiveKey === "conversion",
  ).length;
  const conversionRatio = conversionCount / posts.length;
  if (conversionRatio >= CONVERSION_HEAVY_RATIO) {
    const pct = Math.round(conversionRatio * 100);
    warnings.push(
      `Tỉ trọng bài bán hàng (conversion) đang cao (${pct}%) — cân nhắc tăng nội dung giá trị/giáo dục.`,
    );
  }

  // Luật 2 — pillar yếu: chỉ xét pillar CÓ metric (avgEngagement > 0 trong aggregate
  // nghĩa là có post kèm số). Cần ≥2 pillar có metric để so trung vị.
  const pillarGroups = aggregate(posts).byPillar.filter(
    (g) => g.avgEngagement > 0,
  );
  if (pillarGroups.length >= 2) {
    const engagements = pillarGroups.map((g) => g.avgEngagement);
    const med = median(engagements);
    const weakest = pillarGroups.reduce((a, b) =>
      b.avgEngagement < a.avgEngagement ? b : a,
    );
    if (weakest.avgEngagement < WEAK_PILLAR_MEDIAN_FACTOR * med) {
      warnings.push(
        `Pillar "${weakest.label}" đang yếu (avgEngagement=${weakest.avgEngagement}, dưới nửa trung vị) — cân nhắc giảm tỉ trọng hoặc đổi cách thể hiện.`,
      );
    }
  }

  return warnings;
}
