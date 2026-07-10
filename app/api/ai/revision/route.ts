import { NextRequest, NextResponse } from "next/server";
import { runModule } from "@/lib/ai/run";
import { revisionModule } from "@/lib/prompts/revision";

// D.15 Revision Engine route — server-only (keys never reach the client).
// Flow chính dùng server action; route giữ đủ file-list milestone.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ error: "Body không hợp lệ" }, { status: 400 });
  }

  const result = await runModule(revisionModule, body);

  if (result.ok) {
    return NextResponse.json(result, { status: 200 });
  }
  return NextResponse.json(
    { error: result.error, status: result.status },
    { status: 400 },
  );
}
