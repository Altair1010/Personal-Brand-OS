import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await params;
  const asset = await db.contentAsset.findUnique({ where: { id: assetId } });
  if (!asset || asset.sourceType !== "UPLOAD" || !asset.localPath) {
    return NextResponse.json({ error: "ASSET_NOT_AVAILABLE" }, { status: 404 });
  }

  const artifactRoot = process.env.LOCALAPPDATA
    ? path.resolve(process.env.LOCALAPPDATA, "Piltover", "artifacts")
    : path.resolve(process.cwd(), ".piltover", "artifacts");
  const candidate = path.resolve(asset.localPath);
  if (!candidate.startsWith(artifactRoot + path.sep)) {
    return NextResponse.json({ error: "ASSET_PATH_INVALID" }, { status: 403 });
  }

  try {
    const bytes = await fs.readFile(candidate);
    return new Response(bytes, {
      headers: {
        "content-type": asset.mimeType || "application/octet-stream",
        "content-length": String(bytes.byteLength),
        "cache-control": "private, no-store",
        "content-disposition": `inline; filename="${encodeURIComponent(asset.fileName || "media")}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "ASSET_FILE_MISSING" }, { status: 404 });
  }
}
