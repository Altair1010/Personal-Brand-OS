import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { PrismaControlPlaneHealth } from "@/lib/piltover/modules/platform/infrastructure/prisma-control-plane-health";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await new PrismaControlPlaneHealth(db).read(), { status: 200 });
  } catch {
    return NextResponse.json({
      schemaVersion: "1.0",
      checkedAt: new Date().toISOString(),
      controlPlane: { status: "DOWN" },
      database: { status: "DOWN" },
      error: {
        code: "INTERNAL_DATABASE_UNAVAILABLE",
        message: "The control-plane database is unavailable.",
        retryable: true,
        correlationId: randomUUID(),
      },
    }, { status: 503 });
  }
}
