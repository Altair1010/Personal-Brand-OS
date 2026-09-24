import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { RunResultSchema } from "@/lib/piltover/shared/contracts/control-plane";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;
  const run = await db.agentRun.findUnique({
    where: { id: runId },
    include: {
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          attemptCount: true,
          maxAttempts: true,
          currentLeaseId: true,
          updatedAt: true,
        },
      },
    },
  });
  if (!run) {
    return NextResponse.json({ ok: false, error: "AGENT_RUN_NOT_FOUND" }, { status: 404 });
  }

  const job = run.jobs[0] ?? null;
  const progress = {
    runId: run.id,
    runStatus: run.status,
    jobStatus: job?.status ?? null,
    attemptCount: job?.attemptCount ?? 0,
    maxAttempts: job?.maxAttempts ?? 0,
    leased: Boolean(job?.currentLeaseId),
    updatedAt: (job?.updatedAt ?? run.updatedAt).toISOString(),
  };

  if (run.status === "FAILED" || run.status === "CANCELLED") {
    const terminal =
      run.terminalResult && typeof run.terminalResult === "object" && !Array.isArray(run.terminalResult)
        ? run.terminalResult as Record<string, unknown>
        : null;
    const terminalError =
      terminal?.error && typeof terminal.error === "object" && !Array.isArray(terminal.error)
        ? terminal.error as Record<string, unknown>
        : null;
    const errorMessage =
      typeof terminalError?.message === "string" && terminalError.message.trim()
        ? terminalError.message.trim()
        : run.status === "CANCELLED"
          ? "Agent run was cancelled."
          : "Agent run ended without a usable result.";
    return NextResponse.json(
      {
        ok: false,
        status: run.status,
        progress,
        error: errorMessage,
        errorCode: typeof terminalError?.code === "string" ? terminalError.code : null,
      },
      { status: 409 },
    );
  }
  if (run.status !== "COMPLETED" || !run.terminalResult) {
    return NextResponse.json({ ok: true, pending: true, status: run.status, progress }, { status: 202 });
  }

  const terminal = RunResultSchema.parse(run.terminalResult);
  const artifact = terminal.artifacts?.[0];
  if (!artifact) {
    return NextResponse.json({ ok: false, progress, error: "AGENT_RESULT_ARTIFACT_MISSING" }, { status: 422 });
  }
  return NextResponse.json({
    ok: true,
    pending: false,
    status: run.status,
    progress,
    data: artifact.payload,
    artifact: { kind: artifact.kind, ref: artifact.ref },
  });
}
