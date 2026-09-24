import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  createChannelVariant,
  createContentBrief,
  createContentConcept,
  createCreativeTerritories,
  saveContentMaster,
} from "@/lib/piltover/vnext/content-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") {
    return NextResponse.json({ ok: false, error: "ACTION_REQUIRED" }, { status: 400 });
  }
  try {
    if (body.action === "create-brief") {
      const data = await createContentBrief(db, body.input as never);
      return NextResponse.json({ ok: true, data });
    }
    if (body.action === "create-territories") {
      const data = await createCreativeTerritories(db, body.input as never);
      return NextResponse.json({ ok: true, data });
    }
    if (body.action === "create-concept") {
      const data = await createContentConcept(db, body.input as never);
      return NextResponse.json({ ok: true, data });
    }
    if (body.action === "save-master") {
      const data = await saveContentMaster(db, body.input as never);
      return NextResponse.json({ ok: true, data });
    }
    if (body.action === "create-variant") {
      const data = await createChannelVariant(db, body.input as never);
      return NextResponse.json({ ok: true, data });
    }
    return NextResponse.json({ ok: false, error: "ACTION_NOT_SUPPORTED" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "CONTENT_ENGINE_FAILED" }, { status: 400 });
  }
}
