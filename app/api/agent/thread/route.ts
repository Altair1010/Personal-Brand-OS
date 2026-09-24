import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";
import {
  archiveThread,
  createAgentThread,
  ensureAgentThread,
  getThreadStatus,
} from "@/lib/piltover/vnext/agent-thread-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const tenant = await resolveLocalTenant(db);
  const body = await req.json().catch(() => null) as { requestedId?: string } | null;
  const requestedId =
    typeof body?.requestedId === "string" && /^[a-zA-Z0-9._:-]{8,200}$/.test(body.requestedId)
      ? body.requestedId
      : null;
  const thread = requestedId
    ? await ensureAgentThread(db, {
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        brandId: tenant.brandId,
        projectId: tenant.brandId,
      }, requestedId)
    : await createAgentThread(db, {
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        brandId: tenant.brandId,
        projectId: tenant.brandId,
      });
  return NextResponse.json({ ok: true, data: { threadId: thread.id } });
}

export async function GET(req: NextRequest) {
  const threadId = req.nextUrl.searchParams.get("threadId");
  if (!threadId) {
    return NextResponse.json({ ok: false, error: "THREAD_ID_REQUIRED" }, { status: 400 });
  }
  const tenant = await resolveLocalTenant(db);
  const thread = await getThreadStatus(db, threadId);
  if (
    !thread ||
    thread.organizationId !== tenant.organizationId ||
    thread.workspaceId !== tenant.workspaceId ||
    thread.brandId !== tenant.brandId
  ) {
    return NextResponse.json({ ok: false, error: "THREAD_NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, data: thread });
}

export async function DELETE(req: NextRequest) {
  const threadId = req.nextUrl.searchParams.get("threadId");
  if (!threadId) {
    return NextResponse.json({ ok: false, error: "THREAD_ID_REQUIRED" }, { status: 400 });
  }

  const tenant = await resolveLocalTenant(db);
  const thread = await db.agentThread.findUnique({ where: { id: threadId } });
  if (
    !thread ||
    thread.organizationId !== tenant.organizationId ||
    thread.workspaceId !== tenant.workspaceId ||
    thread.brandId !== tenant.brandId
  ) {
    return NextResponse.json({ ok: false, error: "THREAD_NOT_FOUND" }, { status: 404 });
  }
  await archiveThread(db, threadId);
  return NextResponse.json({ ok: true });
}
