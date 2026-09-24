import { NextRequest, NextResponse } from "next/server";
import { dispatchPromptModule } from "@/lib/piltover/modules/agents/infrastructure/agent-ai-route";
import { hookModule } from "@/lib/prompts/hook";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Body kh?ng h?p l?" }, { status: 400 });
  }
  const result = await dispatchPromptModule(hookModule, body);
  return NextResponse.json(
    result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error },
    { status: result.status },
  );
}
