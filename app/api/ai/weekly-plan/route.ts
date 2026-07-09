import { NextRequest, NextResponse } from "next/server";
import { runModule } from "@/lib/ai/run";
import { weeklyPlanModule } from "@/lib/prompts/weekly-plan";

// D.6 Weekly Plan Builder route — server-only (keys never reach the client).
// Pass-through: body chứa weekIndex + daysInWeek. Việc lặp 5 tuần nằm ở server action M6.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ error: "Body không hợp lệ" }, { status: 400 });
  }

  const result = await runModule(weeklyPlanModule, body);

  if (result.ok) {
    return NextResponse.json(result, { status: 200 });
  }
  return NextResponse.json(
    { error: result.error, status: result.status },
    { status: 400 },
  );
}
