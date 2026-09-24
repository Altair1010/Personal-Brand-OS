import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncMarketingProjectContext } from "@/lib/piltover/vnext/project-context-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const context = await syncMarketingProjectContext(db);
  return NextResponse.json({ ok: true, data: context });
}
