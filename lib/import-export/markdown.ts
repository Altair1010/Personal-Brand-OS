// M6 Markdown export — StrategyVersion (đã include weeklyPlans+dailyPlans) → chuỗi Markdown.
// Nội dung tiếng Việt; KHÔNG mất field. Hàm này THUẦN (không chạm DB) — caller phải
// truyền version đã include relations (xem app/api/export/route.ts).

import type { Prisma } from "@prisma/client";
import { OBJECTIVES } from "@/lib/constants";

// Kiểu version kèm relations mà markdown cần đọc.
export type StrategyVersionWithPlans = Prisma.StrategyVersionGetPayload<{
  include: {
    strategy: true;
    weeklyPlans: { include: { dailyPlans: true } };
  };
}>;

// --- helpers đọc Json an toàn (Json field có thể null/undefined) ---
type Ratio = Record<string, number>;

function asRatio(v: Prisma.JsonValue | null | undefined): Ratio | null {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Ratio;
  return null;
}

function asStringArray(v: Prisma.JsonValue | null | undefined): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  return [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asArray(v: Prisma.JsonValue | null | undefined): any[] {
  return Array.isArray(v) ? v : [];
}

function ratioTable(ratio: Ratio | null): string {
  if (!ratio) return "_(không có)_";
  const lines = ["| Mục tiêu | % |", "| --- | --- |"];
  // Giữ thứ tự OBJECTIVES chuẩn, kèm mọi khóa lạ ở cuối (không mất field).
  const keys = [
    ...OBJECTIVES.filter((k) => k in ratio),
    ...Object.keys(ratio).filter((k) => !OBJECTIVES.includes(k as never)),
  ];
  for (const k of keys) lines.push(`| ${k} | ${ratio[k]} |`);
  return lines.join("\n");
}

/**
 * Sinh Markdown đầy đủ cho một StrategyVersion (đã include weeklyPlans+dailyPlans).
 */
export function strategyVersionToMarkdown(
  version: StrategyVersionWithPlans,
): string {
  const s = version.strategy;
  const out: string[] = [];

  out.push(`# Chiến lược: ${s?.name ?? "(chưa đặt tên)"} — v${version.version}`);
  out.push("");
  out.push(`- **Lý do phiên bản:** ${version.reason}`);
  out.push(`- **Khung thời gian:** ${s?.timeframeDays ?? 30} ngày`);
  if (s?.frameworkSlug) out.push(`- **Framework:** ${s.frameworkSlug}`);
  out.push(`- **Tạo lúc:** ${version.createdAt.toISOString()}`);
  out.push("");

  // contentRatio (bảng %)
  out.push("## Tỷ trọng nội dung (contentRatio)");
  out.push("");
  out.push(ratioTable(asRatio(version.contentRatio)));
  out.push("");

  // weeklyThemes (khung tháng D.4)
  out.push("## Khung 5 tuần (weeklyThemes)");
  out.push("");
  const themes = asArray(version.weeklyThemes);
  if (themes.length === 0) {
    out.push("_(không có)_");
  } else {
    for (const t of themes) {
      out.push(
        `### Tuần ${t.weekIndex ?? "?"} — ${t.theme ?? ""}`.trimEnd(),
      );
      if (t.focusPillar) out.push(`- **Pillar trọng tâm:** ${t.focusPillar}`);
      const mix = asRatio(t.objectivesMix);
      if (mix) {
        out.push(
          `- **objectivesMix:** ${Object.entries(mix)
            .map(([k, v]) => `${k} ${v}%`)
            .join(", ")}`,
        );
      }
      out.push("");
    }
  }

  // 30 dailyPlan theo tuần (từ WeeklyPlan/DailyPlan relations)
  out.push("## Kế hoạch 30 ngày (dailyPlans)");
  out.push("");
  const weeks = [...(version.weeklyPlans ?? [])].sort(
    (a, b) => a.weekIndex - b.weekIndex,
  );
  if (weeks.length === 0) {
    out.push("_(không có)_");
    out.push("");
  } else {
    for (const w of weeks) {
      out.push(`### Tuần ${w.weekIndex}${w.theme ? ` — ${w.theme}` : ""}`);
      if (w.notes) out.push(`> ${w.notes}`);
      out.push("");
      out.push("| Ngày | Mục tiêu | Chủ đề gợi ý | CTA gợi ý |");
      out.push("| --- | --- | --- | --- |");
      const days = [...w.dailyPlans].sort((a, b) => a.dayIndex - b.dayIndex);
      for (const d of days) {
        out.push(
          `| ${d.dayIndex} | ${d.plannedObjective ?? ""} | ${d.suggestedTopic ?? ""} | ${d.suggestedCta ?? ""} |`,
        );
      }
      out.push("");
    }
  }

  // ctaPlan
  out.push("## Kế hoạch CTA (ctaPlan)");
  out.push("");
  const cta = asArray(version.ctaPlan);
  if (cta.length === 0) {
    out.push("_(không có)_");
  } else {
    for (const c of cta) {
      out.push(`- **${c.stage ?? ""}** (${c.when ?? ""}): ${c.cta ?? ""}`);
    }
  }
  out.push("");

  // topicMap
  out.push("## Bản đồ chủ đề (topicMap)");
  out.push("");
  const topics = asArray(version.topicMap);
  if (topics.length === 0) {
    out.push("_(không có)_");
  } else {
    for (const tm of topics) {
      out.push(`- **${tm.pillar ?? ""}:** ${asStringArray(tm.topics).join(", ")}`);
    }
  }
  out.push("");

  // kpiToTrack
  out.push("## KPI theo dõi (kpiToTrack)");
  out.push("");
  const kpis = asStringArray(version.kpiToTrack);
  out.push(kpis.length ? kpis.map((k) => `- ${k}`).join("\n") : "_(không có)_");
  out.push("");

  // doNotList
  out.push("## Điều cần tránh (doNotList)");
  out.push("");
  const donot = asStringArray(version.doNotList);
  out.push(donot.length ? donot.map((k) => `- ${k}`).join("\n") : "_(không có)_");
  out.push("");

  // assumptions
  out.push("## Giả định (assumptions)");
  out.push("");
  const assumptions = asStringArray(version.assumptions);
  out.push(
    assumptions.length ? assumptions.map((k) => `- ${k}`).join("\n") : "_(không có)_",
  );
  out.push("");

  return out.join("\n");
}
