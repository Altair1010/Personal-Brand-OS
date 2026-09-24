import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getProviderConnections,
  listProviderConnectionAdapters,
  refreshProviderConnection,
  revokeProviderConnection,
  verifyProviderConnection,
} from "@/lib/piltover/providers/connection-service";
import { ensureDefaultProviderAdapters } from "@/lib/piltover/providers/register-defaults";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  ensureDefaultProviderAdapters();
  const [connections, providers] = await Promise.all([
    getProviderConnections(db),
    Promise.resolve(listProviderConnectionAdapters()),
  ]);
  return NextResponse.json({ ok: true, data: { connections, providers } });
}

export async function POST(request: NextRequest) {
  ensureDefaultProviderAdapters();
  const body = await request.json().catch(() => null) as
    | { action?: string; connectionId?: string }
    | null;
  if (!body?.connectionId || !body.action) {
    return NextResponse.json({ ok: false, error: "ACTION_AND_CONNECTION_REQUIRED" }, { status: 400 });
  }

  try {
    const data =
      body.action === "verify"
        ? await verifyProviderConnection(db, body.connectionId)
        : body.action === "refresh"
          ? await refreshProviderConnection(db, body.connectionId)
          : body.action === "revoke"
            ? await revokeProviderConnection(db, body.connectionId)
            : null;
    if (!data) {
      return NextResponse.json({ ok: false, error: "ACTION_NOT_SUPPORTED" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "PROVIDER_ACTION_FAILED" },
      { status: 400 },
    );
  }
}
