import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensurePublishingJob, executePublishingJob, manualRetryPublishingJob, reconcileUnknownPublishingJob } from "@/lib/piltover/vnext/publishing-engine";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";
import { PrismaApproval } from "@/lib/piltover/modules/approvals/infrastructure/prisma-approval";
import { getSupabaseConfigOrThrow } from "@/lib/supabase-config";
import { stableHash } from "@/lib/piltover/shared/contracts/stable-json";
import { authorizeToolAction } from "@/lib/piltover/vnext/tool-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function actorFromRequest(req: NextRequest) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new Error("AUTH_REQUIRED");
  const { url, anonKey } = getSupabaseConfigOrThrow();
  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error("AUTH_INVALID");
  return { provider: "supabase", subject: data.user.id } as const;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as null | {
    action?: string;
    jobId?: string;
    approvalId?: string;
    contentVariantId?: string;
    integrationId?: string;
    scheduledAt?: string | null;
    providerPayload?: unknown;
    outcome?: "CONFIRMED_PUBLISHED" | "CONFIRMED_NOT_PUBLISHED";
    providerPostId?: string | null;
  };

  if (body?.action === "reconcile") {
    if (!body.jobId || !body.outcome) {
      return NextResponse.json({ ok: false, error: "RECONCILIATION_INPUT_REQUIRED" }, { status: 400 });
    }
    try {
      const actor = await actorFromRequest(req);
      const tenant = await resolveLocalTenant(db);
      const identity = await db.authIdentity.findUnique({ where: { provider_subject: actor } });
      const job = await db.publishingJob.findUnique({ where: { id: body.jobId } });
      if (!job || job.organizationId !== tenant.organizationId || job.brandId !== tenant.brandId) {
        return NextResponse.json({ ok: false, error: "PUBLISHING_JOB_NOT_FOUND" }, { status: 404 });
      }
      const data = await reconcileUnknownPublishingJob(db, {
        jobId: job.id,
        outcome: body.outcome,
        providerPostId: body.providerPostId ?? null,
        actorId: identity?.userIdentityId ?? actor.subject,
      });
      return NextResponse.json({ ok: true, data });
    } catch (error) {
      return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "RECONCILIATION_FAILED" }, { status: 409 });
    }
  }

  if (body?.action === "retry") {
    if (!body.jobId) return NextResponse.json({ ok: false, error: "JOB_ID_REQUIRED" }, { status: 400 });
    try {
      const actor = await actorFromRequest(req);
      const tenant = await resolveLocalTenant(db);
      const identity = await db.authIdentity.findUnique({ where: { provider_subject: actor } });
      const job = await db.publishingJob.findUnique({ where: { id: body.jobId } });
      if (!job || job.organizationId !== tenant.organizationId || job.brandId !== tenant.brandId) {
        return NextResponse.json({ ok: false, error: "PUBLISHING_JOB_NOT_FOUND" }, { status: 404 });
      }
      const data = await manualRetryPublishingJob(db, {
        jobId: job.id,
        actorId: identity?.userIdentityId ?? actor.subject,
      });
      return NextResponse.json({ ok: true, data });
    } catch (error) {
      return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "PUBLISH_RETRY_FAILED" }, { status: 409 });
    }
  }

  if (body?.action === "requestApproval") {
    if (!body.jobId) return NextResponse.json({ ok: false, error: "JOB_ID_REQUIRED" }, { status: 400 });
    try {
      const actor = await actorFromRequest(req);
      const tenant = await resolveLocalTenant(db);
      const job = await db.publishingJob.findUnique({ where: { id: body.jobId } });
      if (!job || job.organizationId !== tenant.organizationId || job.brandId !== tenant.brandId) {
        return NextResponse.json({ ok: false, error: "PUBLISHING_JOB_NOT_FOUND" }, { status: 404 });
      }
      const toolDecision = await authorizeToolAction(db, {
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        brandId: tenant.brandId,
        agentDefinitionId: null,
        toolNamespace: "publishing",
        action: "publish",
        mode: "write",
      });
      if (toolDecision.allowed) {
        return NextResponse.json({ ok: false, error: "APPROVAL_NOT_REQUIRED", grantId: toolDecision.grantId }, { status: 409 });
      }
      if (toolDecision.reason !== "APPROVAL_REQUIRED") {
        return NextResponse.json({ ok: false, error: `TOOL_${toolDecision.reason}` }, { status: 403 });
      }
      const approval = await new PrismaApproval(db).request(actor, {
        id: randomUUID(),
        target: { type: "BRAND", id: tenant.brandId },
        actionType: "publishing.publish",
        targetRef: `publishing-job:${job.id}`,
        payload: job.providerPayload,
        requiredCapability: "content.publish",
        expiresAt: new Date(Date.now() + 30 * 60_000),
        oneTimeNonce: randomUUID(),
        correlationId: job.idempotencyKey,
      });
      return NextResponse.json({ ok: true, data: approval });
    } catch (error) {
      return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "APPROVAL_REQUEST_FAILED" }, { status: 403 });
    }
  }

  if (body?.action === "execute") {
    if (!body.jobId) return NextResponse.json({ ok: false, error: "JOB_ID_REQUIRED" }, { status: 400 });
    try {
      const tenant = await resolveLocalTenant(db);
      const job = await db.publishingJob.findUnique({ where: { id: body.jobId } });
      if (!job || job.organizationId !== tenant.organizationId || job.brandId !== tenant.brandId) {
        return NextResponse.json({ ok: false, error: "PUBLISHING_JOB_NOT_FOUND" }, { status: 404 });
      }
      const toolDecision = await authorizeToolAction(db, {
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        brandId: tenant.brandId,
        agentDefinitionId: null,
        toolNamespace: "publishing",
        action: "publish",
        mode: "write",
      });
      if (!toolDecision.allowed && toolDecision.reason !== "APPROVAL_REQUIRED") {
        return NextResponse.json({ ok: false, error: `TOOL_${toolDecision.reason}` }, { status: 403 });
      }

      let actorId = "authorized-user";
      if (!toolDecision.allowed) {
        if (!body.approvalId) return NextResponse.json({ ok: false, error: "APPROVAL_REQUIRED" }, { status: 428 });
        const approval = await db.approvalRequest.findUnique({ where: { id: body.approvalId } });
        const approvalValid =
          approval &&
          approval.status === "APPROVED" &&
          approval.consumedAt !== null &&
          approval.actionType === "publishing.publish" &&
          approval.targetRef === `publishing-job:${job.id}` &&
          approval.payloadHash === stableHash(job.providerPayload) &&
          approval.expiresAt > new Date();
        if (!approvalValid) {
          return NextResponse.json({ ok: false, error: "VALID_CONSUMED_APPROVAL_REQUIRED" }, { status: 428 });
        }
        actorId = approval.decidedByUserIdentityId ?? "approved-user";
      }

      const data = await executePublishingJob(db, job.id, { actorType: "HUMAN", actorId });
      return NextResponse.json({ ok: true, data });
    } catch (error) {
      return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "PUBLISH_FAILED" }, { status: 409 });
    }
  }
  if (!body?.contentVariantId || !body.integrationId || body.providerPayload === undefined) {
    return NextResponse.json({ ok: false, error: "PUBLISHING_INPUT_REQUIRED" }, { status: 400 });
  }
  const variant = await db.channelVariant.findUnique({ where: { id: body.contentVariantId } });
  if (!variant) return NextResponse.json({ ok: false, error: "CONTENT_VARIANT_NOT_FOUND" }, { status: 404 });
  const master = await db.contentMaster.findUnique({ where: { id: variant.contentMasterId } });
  if (!master) return NextResponse.json({ ok: false, error: "CONTENT_MASTER_NOT_FOUND" }, { status: 404 });
  const gate = await db.qualityGate.findFirst({
    where: { artifactType: "CONTENT_MASTER", artifactId: master.id },
    orderBy: { createdAt: "desc" },
  });
  if (!gate || gate.status !== "PASS") {
    return NextResponse.json({ ok: false, error: "QUALITY_GATE_REQUIRED" }, { status: 409 });
  }

  const tenant = await resolveLocalTenant(db);
  const job = await ensurePublishingJob(db, {
    organizationId: tenant.organizationId,
    brandId: tenant.brandId,
    contentVariantId: variant.id,
    integrationId: body.integrationId,
    scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
    providerPayload: body.providerPayload,
    idempotencyMaterial: { variantId: variant.id, integrationId: body.integrationId, scheduledAt: body.scheduledAt ?? null, payload: body.providerPayload },
  });
  return NextResponse.json({ ok: true, data: job });
}
