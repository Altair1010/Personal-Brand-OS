import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { strategyVersionToMarkdown } from "@/lib/import-export/markdown";

// M6 Strategy export route — server-only.
export const runtime = "nodejs";

const USER_ID = "local";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const explicitId =
    body && typeof body === "object" && typeof body.strategyVersionId === "string"
      ? body.strategyVersionId
      : null;

  // Resolve version: dùng strategyVersionId nếu có, ngược lại lấy version mới nhất
  // của AppState.activeStrategyId.
  let versionId = explicitId;
  if (!versionId) {
    const appState = await db.appState.findUnique({ where: { id: "singleton" } });
    if (!appState?.activeStrategyId) {
      return NextResponse.json(
        { error: "Không có strategyVersionId và cũng không có activeStrategyId." },
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
        { error: "Strategy đang active chưa có version nào." },
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
      { error: "Không tìm thấy StrategyVersion." },
      { status: 404 },
    );
  }

  const markdown = strategyVersionToMarkdown(version);
  const slug = (version.strategy?.name ?? "strategy")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const filename = `${slug || "strategy"}-v${version.version}.md`;

  await db.exportHistory.create({
    data: {
      userId: USER_ID,
      kind: "markdown",
      scope: "strategy",
      filename,
    },
  });

  return NextResponse.json({ markdown, filename }, { status: 200 });
}
