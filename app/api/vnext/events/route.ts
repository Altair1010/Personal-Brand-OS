import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const encoder = new TextEncoder();
const sse = (type: string, data: unknown) =>
  encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);

export async function GET(req: NextRequest) {
  const tenant = await resolveLocalTenant(db);
  let last = "";
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(sse("connected", { at: new Date().toISOString() }));
      const tick = async () => {
        if (req.signal.aborted) return;
        const [publishing, performance, recommendation, experiment, approvals] = await Promise.all([
          db.publishingJob.findFirst({
            where: { organizationId: tenant.organizationId, brandId: tenant.brandId },
            orderBy: { createdAt: "desc" },
            select: { id: true, status: true, completedAt: true, createdAt: true },
          }),
          db.performanceSnapshot.findFirst({
            where: { organizationId: tenant.organizationId, brandId: tenant.brandId },
            orderBy: { capturedAt: "desc" },
            select: { id: true, capturedAt: true },
          }),
          db.recommendation.findFirst({
            where: { organizationId: tenant.organizationId, brandId: tenant.brandId },
            orderBy: { updatedAt: "desc" },
            select: { id: true, status: true, updatedAt: true },
          }),
          db.experiment.findFirst({
            where: { organizationId: tenant.organizationId, brandId: tenant.brandId },
            orderBy: { updatedAt: "desc" },
            select: { id: true, status: true, updatedAt: true },
          }),
          db.approvalRequest.count({
            where: { organizationId: tenant.organizationId, status: "PENDING" },
          }),
        ]);
        const snapshot = {
          publishing: publishing ? { ...publishing, createdAt: publishing.createdAt.toISOString(), completedAt: publishing.completedAt?.toISOString() ?? null } : null,
          performance: performance ? { id: performance.id, capturedAt: performance.capturedAt.toISOString() } : null,
          recommendation: recommendation ? { id: recommendation.id, status: recommendation.status, updatedAt: recommendation.updatedAt.toISOString() } : null,
          experiment: experiment ? { id: experiment.id, status: experiment.status, updatedAt: experiment.updatedAt.toISOString() } : null,
          approvals,
        };
        const fingerprint = JSON.stringify(snapshot);
        if (fingerprint !== last) {
          const previous = last;
          last = fingerprint;
          controller.enqueue(sse(previous ? "STATE_DELTA" : "STATE_SNAPSHOT", {
            eventId: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            payload: snapshot,
          }));
        }
      };
      await tick().catch(() => {});
      const timer = setInterval(() => void tick().catch(() => {}), 2000);
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
