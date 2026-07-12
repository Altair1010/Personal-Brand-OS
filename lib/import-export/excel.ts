// EM2c T10/T11 — Excel export via exceljs. Two builders:
//   - strategyVersionToWorkbook(version): a multi-tab styled workbook for one StrategyVersion
//     (pure — caller passes a version with weeklyPlans+dailyPlans included, like markdown.ts).
//   - dataReportToWorkbook(db): a human-readable multi-tab report of the whole workspace
//     (persona / pillar / active strategy / 30 days / posts / metrics) — NOT a raw 22-table dump.
// Both return a Node Buffer for a route to stream as .xlsx.

import ExcelJS from "exceljs";
import type { Prisma, PrismaClient } from "@prisma/client";
import { OBJECTIVES } from "@/lib/constants";
import type { StrategyVersionWithPlans } from "./markdown";

// --- styling helpers -------------------------------------------------------

type ColumnDef = { header: string; key: string; width: number };

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF334155" },
};
const THIN: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFE2E8F0" } },
  left: { style: "thin", color: { argb: "FFE2E8F0" } },
  bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
  right: { style: "thin", color: { argb: "FFE2E8F0" } },
};

function addSheet(
  wb: ExcelJS.Workbook,
  name: string,
  columns: ColumnDef[],
  rows: Record<string, unknown>[],
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(name);
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  for (const r of rows) ws.addRow(r);

  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = HEADER_FILL;
  header.alignment = { vertical: "middle" };
  header.height = 20;
  ws.views = [{ state: "frozen", ySplit: 1 }];

  ws.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = THIN;
      cell.alignment = { ...cell.alignment, wrapText: true, vertical: "top" };
    });
  });
  return ws;
}

// --- Json readers (Json fields may be null) --------------------------------

type Ratio = Record<string, number>;

function asRatio(v: Prisma.JsonValue | null | undefined): Ratio | null {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Ratio;
  return null;
}
function asStringArray(v: Prisma.JsonValue | null | undefined): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asArray(v: Prisma.JsonValue | null | undefined): any[] {
  return Array.isArray(v) ? v : [];
}

// --- T10: one StrategyVersion → workbook -----------------------------------

export async function strategyVersionToWorkbook(
  version: StrategyVersionWithPlans,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Personal Brand OS";
  wb.created = new Date();

  const s = version.strategy;

  // Tổng quan
  addSheet(
    wb,
    "Tổng quan",
    [
      { header: "Mục", key: "k", width: 24 },
      { header: "Giá trị", key: "v", width: 70 },
    ],
    [
      { k: "Tên chiến lược", v: s?.name ?? "(chưa đặt tên)" },
      { k: "Phiên bản", v: `v${version.version}` },
      { k: "Lý do phiên bản", v: version.reason },
      { k: "Khung thời gian", v: `${s?.timeframeDays ?? 30} ngày` },
      { k: "Framework", v: s?.frameworkSlug ?? "—" },
      { k: "Tạo lúc", v: version.createdAt.toISOString() },
      { k: "Chỉnh sửa tay", v: version.editedAt ? version.editedAt.toISOString() : "—" },
    ],
  );

  // Tỷ trọng
  const ratio = asRatio(version.contentRatio);
  const ratioKeys = ratio
    ? [
        ...OBJECTIVES.filter((k) => k in ratio),
        ...Object.keys(ratio).filter((k) => !OBJECTIVES.includes(k as never)),
      ]
    : [];
  addSheet(
    wb,
    "Tỷ trọng",
    [
      { header: "Mục tiêu", key: "objective", width: 24 },
      { header: "Tỷ trọng (%)", key: "percent", width: 16 },
    ],
    ratioKeys.map((k) => ({ objective: k, percent: ratio?.[k] ?? 0 })),
  );

  // 30 ngày
  const dayRows: Record<string, unknown>[] = [];
  const weeks = [...(version.weeklyPlans ?? [])].sort(
    (a, b) => a.weekIndex - b.weekIndex,
  );
  for (const w of weeks) {
    const days = [...w.dailyPlans].sort((a, b) => a.dayIndex - b.dayIndex);
    for (const d of days) {
      dayRows.push({
        week: w.weekIndex,
        day: d.dayIndex,
        objective: d.plannedObjective ?? "",
        topic: d.suggestedTopic ?? "",
        cta: d.suggestedCta ?? "",
      });
    }
  }
  addSheet(
    wb,
    "30 ngày",
    [
      { header: "Tuần", key: "week", width: 8 },
      { header: "Ngày", key: "day", width: 8 },
      { header: "Mục tiêu", key: "objective", width: 16 },
      { header: "Chủ đề gợi ý", key: "topic", width: 50 },
      { header: "CTA gợi ý", key: "cta", width: 30 },
    ],
    dayRows,
  );

  // CTA
  addSheet(
    wb,
    "CTA",
    [
      { header: "Giai đoạn", key: "stage", width: 24 },
      { header: "Thời điểm", key: "when", width: 24 },
      { header: "CTA", key: "cta", width: 50 },
    ],
    asArray(version.ctaPlan).map((c) => ({
      stage: c?.stage ?? "",
      when: c?.when ?? "",
      cta: c?.cta ?? "",
    })),
  );

  // Bản đồ chủ đề
  addSheet(
    wb,
    "Bản đồ chủ đề",
    [
      { header: "Trụ cột", key: "pillar", width: 28 },
      { header: "Chủ đề", key: "topics", width: 70 },
    ],
    asArray(version.topicMap).map((tm) => ({
      pillar: tm?.pillar ?? "",
      topics: asStringArray(tm?.topics).join(", "),
    })),
  );

  // KPI & Tránh
  const kpiRows = [
    ...asStringArray(version.kpiToTrack).map((x) => ({ type: "KPI", content: x })),
    ...asStringArray(version.doNotList).map((x) => ({ type: "Tránh", content: x })),
  ];
  addSheet(
    wb,
    "KPI & Tránh",
    [
      { header: "Loại", key: "type", width: 12 },
      { header: "Nội dung", key: "content", width: 70 },
    ],
    kpiRows,
  );

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

// --- T11: whole-workspace readable report ----------------------------------

const USER_ID = "local";

export async function dataReportToWorkbook(db: PrismaClient): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Personal Brand OS";
  wb.created = new Date();

  const appState = await db.appState.findUnique({ where: { id: "singleton" } });
  const activeGoalId = appState?.activeGoalId ?? null;
  const activeStrategyId = appState?.activeStrategyId ?? null;

  // Persona
  const personas = activeGoalId
    ? await db.audienceSegment.findMany({
        where: { userId: USER_ID, goalId: activeGoalId },
        orderBy: { createdAt: "asc" },
      })
    : [];
  addSheet(
    wb,
    "Persona",
    [
      { header: "Tên", key: "name", width: 24 },
      { header: "Nỗi đau", key: "pain", width: 36 },
      { header: "Niềm tin sai", key: "falseBelief", width: 36 },
      { header: "Nỗi sợ", key: "fear", width: 30 },
      { header: "Khát khao", key: "desire", width: 30 },
      { header: "Góc nội dung", key: "contentAngle", width: 30 },
      { header: "CTA", key: "cta", width: 24 },
      { header: "Offer", key: "offer", width: 24 },
    ],
    personas.map((p) => ({
      name: p.name,
      pain: p.pain ?? "",
      falseBelief: p.falseBelief ?? "",
      fear: p.fear ?? "",
      desire: p.desire ?? "",
      contentAngle: p.contentAngle ?? "",
      cta: p.cta ?? "",
      offer: p.offer ?? "",
    })),
  );

  // Trụ cột
  const pillars = activeGoalId
    ? await db.contentPillar.findMany({
        where: { userId: USER_ID, goalId: activeGoalId, status: "active" },
        orderBy: { createdAt: "asc" },
      })
    : [];
  addSheet(
    wb,
    "Trụ cột",
    [
      { header: "Tên", key: "name", width: 28 },
      { header: "Tỷ trọng (%)", key: "ratio", width: 16 },
      { header: "Mô tả", key: "description", width: 60 },
    ],
    pillars.map((p) => ({
      name: p.name,
      ratio: p.ratioPercent,
      description: p.description ?? "",
    })),
  );

  // Chiến lược (active) + 30 ngày
  const version = activeStrategyId
    ? await db.strategyVersion.findFirst({
        where: { strategyId: activeStrategyId },
        orderBy: { version: "desc" },
        include: {
          strategy: true,
          weeklyPlans: { include: { dailyPlans: { include: { plannedPillar: true } } } },
        },
      })
    : null;

  addSheet(
    wb,
    "Chiến lược (active)",
    [
      { header: "Mục", key: "k", width: 24 },
      { header: "Giá trị", key: "v", width: 70 },
    ],
    version
      ? [
          { k: "Tên", v: version.strategy?.name ?? "" },
          { k: "Phiên bản", v: `v${version.version}` },
          { k: "Lý do", v: version.reason },
          { k: "Framework", v: version.strategy?.frameworkSlug ?? "—" },
          { k: "Chỉnh sửa tay", v: version.editedAt ? version.editedAt.toISOString() : "—" },
        ]
      : [{ k: "Trạng thái", v: "Chưa có chiến lược đang hoạt động" }],
  );

  const dayRows: Record<string, unknown>[] = [];
  if (version) {
    const weeks = [...version.weeklyPlans].sort((a, b) => a.weekIndex - b.weekIndex);
    for (const w of weeks) {
      const days = [...w.dailyPlans].sort((a, b) => a.dayIndex - b.dayIndex);
      for (const d of days) {
        dayRows.push({
          week: w.weekIndex,
          day: d.dayIndex,
          objective: d.plannedObjective ?? "",
          pillar: d.plannedPillar?.name ?? "",
          topic: d.suggestedTopic ?? "",
          cta: d.suggestedCta ?? "",
        });
      }
    }
  }
  addSheet(
    wb,
    "30 ngày",
    [
      { header: "Tuần", key: "week", width: 8 },
      { header: "Ngày", key: "day", width: 8 },
      { header: "Mục tiêu", key: "objective", width: 16 },
      { header: "Trụ cột", key: "pillar", width: 24 },
      { header: "Chủ đề", key: "topic", width: 46 },
      { header: "CTA", key: "cta", width: 28 },
    ],
    dayRows,
  );

  // Bài đăng + Chỉ số
  const posts = await db.post.findMany({
    where: { userId: USER_ID },
    orderBy: { createdAt: "asc" },
    include: {
      metrics: true,
      dailyPlan: { select: { dayIndex: true } },
    },
  });
  addSheet(
    wb,
    "Bài đăng",
    [
      { header: "Ngày (kế hoạch)", key: "day", width: 14 },
      { header: "Trạng thái", key: "status", width: 14 },
      { header: "Mục tiêu", key: "objective", width: 16 },
      { header: "Chủ đề", key: "topic", width: 46 },
      { header: "Permalink", key: "permalink", width: 40 },
      { header: "Tạo lúc", key: "createdAt", width: 22 },
    ],
    posts.map((p) => ({
      day: p.dailyPlan?.dayIndex ?? "",
      status: p.status,
      objective: p.objectiveKey ?? "",
      topic: p.topic ?? "",
      permalink: p.permalink ?? "",
      createdAt: p.createdAt.toISOString(),
    })),
  );

  const metricRows: Record<string, unknown>[] = [];
  for (const p of posts) {
    for (const m of p.metrics) {
      metricRows.push({
        day: p.dailyPlan?.dayIndex ?? "",
        topic: p.topic ?? "",
        source: m.source,
        reach: m.reach ?? "",
        engagement: m.engagement ?? "",
        comments: m.comments ?? "",
        saves: m.saves ?? "",
        daysSincePost: m.daysSincePost ?? "",
      });
    }
  }
  addSheet(
    wb,
    "Chỉ số",
    [
      { header: "Ngày (kế hoạch)", key: "day", width: 14 },
      { header: "Chủ đề", key: "topic", width: 40 },
      { header: "Nguồn", key: "source", width: 16 },
      { header: "Reach", key: "reach", width: 12 },
      { header: "Engagement", key: "engagement", width: 14 },
      { header: "Comments", key: "comments", width: 12 },
      { header: "Saves", key: "saves", width: 12 },
      { header: "Ngày sau đăng", key: "daysSincePost", width: 14 },
    ],
    metricRows,
  );

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
