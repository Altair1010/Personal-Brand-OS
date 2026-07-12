import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  exportBackup,
  importBackup,
  backupEnvelopeSchema,
} from "@/lib/import-export/backup";
import { dataReportToWorkbook } from "@/lib/import-export/excel";

// M10 full-DB backup route — server-only. GET exports all 22 entities as one JSON
// envelope; POST validates then restores. A bad file returns 400 without touching the DB.
// EM2c T11: GET ?format=xlsx returns a human-readable multi-tab Excel report instead.
export const runtime = "nodejs";

const USER_ID = "local";

export async function GET(req: NextRequest) {
  const date = new Date().toISOString().slice(0, 10);

  if (req.nextUrl.searchParams.get("format") === "xlsx") {
    const buffer = await dataReportToWorkbook(db);
    const filename = `personal-brand-report-${date}.xlsx`;
    await db.exportHistory.create({
      data: { userId: USER_ID, kind: "excel", scope: "report", filename },
    });
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const envelope = await exportBackup(db);
  const filename = `personal-brand-backup-${date}.json`;

  await db.exportHistory.create({
    data: {
      userId: USER_ID,
      kind: "backup",
      filename,
    },
  });

  return NextResponse.json(envelope, {
    status: 200,
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  const parsed = backupEnvelopeSchema.safeParse(body);
  if (!parsed.success) {
    // Reject a corrupt/wrong file BEFORE any DB write.
    return NextResponse.json(
      { error: "File backup không hợp lệ" },
      { status: 400 },
    );
  }

  try {
    await importBackup(db, parsed.data);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Khôi phục backup thất bại.",
      },
      { status: 500 },
    );
  }
}
