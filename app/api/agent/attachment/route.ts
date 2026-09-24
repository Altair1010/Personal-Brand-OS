import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return new Response("ATTACHMENT_ID_REQUIRED", { status: 400 });

  const tenant = await resolveLocalTenant(db);
  const attachment = await db.chatAttachment.findUnique({
    where: { id },
    include: { thread: true },
  });
  if (
    !attachment ||
    attachment.thread.organizationId !== tenant.organizationId ||
    attachment.thread.workspaceId !== tenant.workspaceId ||
    attachment.thread.brandId !== tenant.brandId
  ) return new Response("ATTACHMENT_NOT_FOUND", { status: 404 });
  if (!attachment.fileRef || attachment.fileRef.startsWith("inline:")) {
    return new Response("ATTACHMENT_FILE_UNAVAILABLE", { status: 404 });
  }
  const bytes = await fs.readFile(path.resolve(attachment.fileRef)).catch(() => null);
  if (!bytes) return new Response("ATTACHMENT_FILE_NOT_FOUND", { status: 404 });

  return new Response(bytes, {
    headers: {
      "Content-Type": attachment.mimeType || "application/octet-stream",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}