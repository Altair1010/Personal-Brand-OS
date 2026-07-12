import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { strategyVersionToWorkbook } from "@/lib/import-export/excel";

// EM2c T10 — Excel export of one StrategyVersion. GET ?versionId=<id> (falls back to the
// active strategy's latest version). Streams an .xlsx buffer + records ExportHistory.
export const runtime = "nodejs";

const USER_ID = "local";

export async function GET(req: NextRequest) {
  const explicitId = req.nextUrl.searchParams.get("versionId");

  let versionId = explicitId;
  if (!versionId) {
    const appState = await db.appState.findUnique({ where: { id: "singleton" } });
    if (!appState?.activeStrategyId) {
      return NextResponse.json(
        { error: "Không có versionId và cũng không có chiến lược đang hoạt động." },
        { status: 400 },
      );
    }
    const latest = await db.strategyVersion.findFirst({
      where: { strategyId: appState.activeStrategyId },
      orderBy: { version: "desc" },
      select: { id: true },
    });
    if (!latest) {
      return NextResponse.json(
        { error: "Chiến lược đang hoạt động chưa có phiên bản nào." },
        { status: 404 },
      );
    }
    versionId = latest.id;
  }

  const version = await db.strategyVersion.findUnique({
    where: { id: versionId },
    include: {
      strategy: true,
      weeklyPlans: { include: { dailyPlans: true } },
    },
  });
  if (!version) {
    return NextResponse.json(
      { error: "Không tìm thấy phiên bản chiến lược." },
      { status: 404 },
    );
  }

  const buffer = await strategyVersionToWorkbook(version);
  const slug = (version.strategy?.name ?? "strategy")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const filename = `${slug || "strategy"}-v${version.version}.xlsx`;

  await db.exportHistory.create({
    data: { userId: USER_ID, kind: "excel", scope: "strategy", filename },
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
