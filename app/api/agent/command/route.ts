import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";
import { syncMarketingProjectContext } from "@/lib/piltover/vnext/project-context-service";
import {
  assertAgentRunTransition,
  assertJobTransition,
  type AgentRunStatus,
  type JobStatus,
} from "@/lib/piltover/modules/agents/domain/state-machines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireThread(threadId: string) {
  const tenant = await resolveLocalTenant(db);
  const thread = await db.agentThread.findUnique({ where: { id: threadId } });
  if (
    !thread ||
    thread.organizationId !== tenant.organizationId ||
    thread.workspaceId !== tenant.workspaceId ||
    thread.brandId !== tenant.brandId
  ) throw new Error("THREAD_NOT_FOUND");
  return { tenant, thread };
}

async function stopLatestRun(threadId: string) {
  return db.$transaction(async (tx) => {
    const run = await tx.agentRun.findFirst({
      where: {
        threadId,
        status: { notIn: ["COMPLETED", "FAILED", "CANCELLED"] },
      },
      orderBy: { createdAt: "desc" },
      include: { jobs: true },
    });
    if (!run) return null;

    assertAgentRunTransition(run.status as AgentRunStatus, "CANCELLED");
    const now = new Date();
    for (const job of run.jobs) {
      if (["COMPLETED", "FAILED", "CANCELLED"].includes(job.status)) continue;
      assertJobTransition(job.status as JobStatus, "CANCELLED");
      if (job.currentLeaseId) {
        await tx.workerLease.update({
          where: { id: job.currentLeaseId },
          data: { endedAt: now, endReason: "USER_STOP" },
        });
      }
      await tx.job.update({
        where: { id: job.id },
        data: { status: "CANCELLED", currentLeaseId: null },
      });
    }

    await tx.approvalRequest.updateMany({
      where: { runId: run.id, status: "PENDING" },
      data: { status: "CANCELLED", decidedAt: now, decision: "CANCELLED" },
    });
    await tx.agentRun.update({
      where: { id: run.id },
      data: { status: "CANCELLED", completedAt: now },
    });
    await tx.auditEntry.create({
      data: {
        id: randomUUID(),
        organizationId: run.organizationId,
        actorType: "HUMAN",
        actorId: "local",
        action: "AGENT_RUN_CANCELLED",
        targetType: "AGENT_RUN",
        targetId: run.id,
        correlationId: run.correlationId,
        metadata: { source: "slash-command", threadId },
        occurredAt: now,
      },
    });
    return run.id;
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { threadId?: string; command?: string } | null;
  const threadId = body?.threadId?.trim();
  const command = body?.command?.trim().toLowerCase();
  if (!threadId || !command) {
    return NextResponse.json({ ok: false, error: "THREAD_AND_COMMAND_REQUIRED" }, { status: 400 });
  }

  try {
    const { tenant } = await requireThread(threadId);

    if (command === "/context") {
      const context = await syncMarketingProjectContext(db);
      return NextResponse.json({ ok: true, data: { kind: "context", context } });
    }

    if (command === "/artifacts") {
      const [attachments, checkpoints, runs] = await Promise.all([
        db.chatAttachment.findMany({ where: { threadId }, orderBy: { createdAt: "desc" }, take: 20 }),
        db.agentCheckpoint.findMany({ where: { threadId }, orderBy: { sequence: "desc" }, take: 20 }),
        db.agentRun.findMany({
          where: { threadId },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { id: true, terminalResult: true, createdAt: true },
        }),
      ]);
      return NextResponse.json({ ok: true, data: { kind: "artifacts", attachments, checkpoints, runs } });
    }

    if (command === "/tools") {
      const grants = await db.toolGrant.findMany({
        where: {
          organizationId: tenant.organizationId,
          OR: [{ brandId: tenant.brandId }, { brandId: null }],
          status: "ACTIVE",
        },
        orderBy: [{ toolNamespace: "asc" }, { action: "asc" }],
      });
      return NextResponse.json({ ok: true, data: { kind: "tools", grants } });
    }

    if (command === "/model" || command === "/agent" || command === "/status") {
      const latest = await db.agentRun.findFirst({
        where: { threadId },
        orderBy: { createdAt: "desc" },
        include: { jobs: { orderBy: { createdAt: "desc" }, take: 1 } },
      });
      const defaults = command === "/model"
        ? await db.aIModelConfig.findFirst({ where: { isDefault: true } })
        : null;
      return NextResponse.json({
        ok: true,
        data: {
          kind: command.slice(1),
          threadId,
          latestRun: latest
            ? {
                id: latest.id,
                status: latest.status,
                roleRef: latest.roleRef,
                agentVersionId: latest.agentVersionId,
                promptVersionId: latest.promptVersionId,
                skillVersionRefs: latest.skillVersionRefs,
                modelRef: latest.modelRef,
                tokenUsage: latest.tokenUsage,
                costMinor: latest.costMinor,
                traceId: latest.traceId,
                jobStatus: latest.jobs[0]?.status ?? null,
              }
            : null,
          configuredModel: defaults ? { provider: defaults.provider, model: defaults.model } : null,
        },
      });
    }

    if (command === "/stop") {
      const runId = await stopLatestRun(threadId);
      return NextResponse.json({ ok: true, data: { kind: "stop", runId } });
    }

    return NextResponse.json({ ok: false, error: "COMMAND_NOT_SUPPORTED" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "COMMAND_FAILED" },
      { status: 400 },
    );
  }
}
