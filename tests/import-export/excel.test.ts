// EM2c T10 — strategyVersionToWorkbook is pure (no DB). Assert it produces every expected
// tab and round-trips through ExcelJS with the strategy data landed in the right sheets.

import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { strategyVersionToWorkbook } from "@/lib/import-export/excel";
import type { StrategyVersionWithPlans } from "@/lib/import-export/markdown";

function fakeVersion(): StrategyVersionWithPlans {
  return {
    id: "v1",
    strategyId: "s1",
    version: 2,
    reason: "khởi tạo",
    assumptions: ["a1"],
    contentRatio: { seo: 20, educate: 30, trust: 50 },
    weeklyThemes: null,
    dailyPlanOutline: null,
    ctaPlan: [{ stage: "TOFU", when: "tuần 1", cta: "Theo dõi" }],
    topicMap: [{ pillar: "Trụ cột A", topics: ["x", "y"] }],
    recommendedTemplates: null,
    kpiToTrack: ["reach"],
    doNotList: ["đừng spam"],
    aiPromptRunId: null,
    editedAt: null,
    createdAt: new Date("2026-07-12T00:00:00.000Z"),
    strategy: {
      id: "s1",
      userId: "local",
      goalId: "g1",
      name: "Chiến lược Khang",
      timeframeDays: 30,
      frameworkSlug: null,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    weeklyPlans: [
      {
        id: "w1",
        strategyVersionId: "v1",
        weekIndex: 1,
        theme: "Tuần 1",
        focusPillarId: null,
        objectivesMix: null,
        notes: null,
        createdAt: new Date(),
        dailyPlans: [
          {
            id: "d1",
            weeklyPlanId: "w1",
            date: null,
            dayIndex: 1,
            plannedObjective: "educate",
            plannedPillarId: null,
            suggestedTopic: "Chủ đề 1",
            suggestedCta: "CTA 1",
            status: "planned",
            createdAt: new Date(),
          },
        ],
      },
    ],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("strategyVersionToWorkbook", () => {
  it("emits all expected tabs and lands data", async () => {
    const buf = await strategyVersionToWorkbook(fakeVersion());
    const wb = new ExcelJS.Workbook();
    // Node's Buffer<ArrayBufferLike> vs ExcelJS's Buffer param — coerce to the exact param type.
    await wb.xlsx.load(buf as unknown as Parameters<typeof wb.xlsx.load>[0]);

    const names = wb.worksheets.map((w) => w.name);
    expect(names).toEqual([
      "Tổng quan",
      "Tỷ trọng",
      "30 ngày",
      "CTA",
      "Bản đồ chủ đề",
      "KPI & Tránh",
    ]);

    // 30 ngày has header + 1 day row with the topic in column "Chủ đề gợi ý".
    const days = wb.getWorksheet("30 ngày")!;
    expect(days.rowCount).toBe(2);
    expect(days.getRow(2).getCell(4).value).toBe("Chủ đề 1");

    // Tỷ trọng: 3 objectives present.
    expect(wb.getWorksheet("Tỷ trọng")!.rowCount).toBe(4);
  });
});
