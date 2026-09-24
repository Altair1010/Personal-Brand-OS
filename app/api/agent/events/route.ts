import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

function sse(type: string, data: unknown) {
  return encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(req: NextRequest) {
  const threadId = req.nextUrl.searchParams.get("threadId");
  if (!threadId) return new Response("THREAD_ID_REQUIRED", { status: 400 });

  const tenant = await resolveLocalTenant(db);
  const thread = await db.agentThread.findUnique({ where: { id: threadId } });
  if (
    !thread ||
    thread.organizationId !== tenant.organizationId ||
    thread.workspaceId !== tenant.workspaceId ||
    thread.brandId !== tenant.brandId
  ) return new Response("THREAD_NOT_FOUND", { status: 404 });

  const [toolGrantCount, activeContext] = await Promise.all([
    db.toolGrant.count({
      where: {
        organizationId: tenant.organizationId,
        status: "ACTIVE",
        OR: [{ brandId: tenant.brandId }, { brandId: null }],
      },
    }),
    db.marketingProjectContext.findFirst({
      where: {
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        brandId: tenant.brandId,
        status: "ACTIVE",
      },
      orderBy: { version: "desc" },
      select: { id: true, version: true },
    }),
  ]);

  let lastFingerprint = "";
  let lastEventRunId: string | null = null;
  let lastEventSequence = -1;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(sse("connected", { threadId, timestamp: new Date().toISOString() }));

      const tick = async () => {
        if (req.signal.aborted) return;
        const [run, approvals] = await Promise.all([
          db.agentRun.findFirst({
            where: { threadId },
            orderBy: { createdAt: "desc" },
            include: {
              jobs: { orderBy: { createdAt: "desc" }, take: 1 },
            },
          }),
          db.approvalRequest.findMany({
            where: { run: { threadId }, status: "PENDING" },
            orderBy: { createdAt: "asc" },
            take: 10,
          }),
        ]);
        if (run?.id) {
          if (lastEventRunId !== run.id) {
            lastEventRunId = run.id;
            lastEventSequence = -1;
          }
          const events = await db.runEvent.findMany({
            where: { runId: run.id, sequence: { gt: lastEventSequence } },
            orderBy: { sequence: "asc" },
            take: 100,
          });
          for (const event of events) {
            lastEventSequence = event.sequence;
            controller.enqueue(sse(event.eventType, {
              eventId: event.id,
              type: event.eventType,
              threadId,
              runId: run.id,
              timestamp: event.timestamp.toISOString(),
              payload: event.payload ?? {},
              sequence: event.sequence,
            }));
          }
        }

        const snapshot = {
          threadId,
          run: run
            ? {
                id: run.id,
                status: run.status,
                model: run.modelRef,
                agentVersion: run.agentVersionId,
                promptVersion: run.promptVersionId,
                skills: run.skillVersionRefs,
                traceId: run.traceId,
                jobStatus: run.jobs[0]?.status ?? null,
                tokenUsage: run.tokenUsage,
                costMinor: run.costMinor,
              }
            : null,
          tools: { enabled: toolGrantCount },
          context: activeContext
            ? { id: activeContext.id, version: activeContext.version, attached: true }
            : { id: null, version: null, attached: false },
          approvals: approvals.map((item) => ({
            id: item.id,
            actionType: item.actionType,
            targetRef: item.targetRef,
            status: item.status,
          })),
        };

        const fingerprint = JSON.stringify(snapshot);
        if (fingerprint !== lastFingerprint) {
          lastFingerprint = fingerprint;
          controller.enqueue(sse("STATE_SNAPSHOT", {
            eventId: crypto.randomUUID(),
            type: "STATE_SNAPSHOT",
            threadId,
            runId: run?.id ?? null,
            timestamp: new Date().toISOString(),
            payload: snapshot,
          }));
          if (approvals.length > 0) {
            controller.enqueue(sse("APPROVAL_REQUIRED", {
              eventId: crypto.randomUUID(),
              type: "APPROVAL_REQUIRED",
              threadId,
              runId: run?.id ?? null,
              timestamp: new Date().toISOString(),
              payload: { approvals: snapshot.approvals },
            }));
          }
        }
      };

      await tick().catch(() => {});
      const timer = setInterval(() => void tick().catch(() => {}), 1500);
      req.signal.addEventListener("abort", () => {
        clearInterval(timer);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
