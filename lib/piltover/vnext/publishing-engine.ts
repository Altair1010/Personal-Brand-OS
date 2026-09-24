import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Prisma, PrismaClient } from "@prisma/client";
import { stableHash } from "@/lib/piltover/shared/contracts/stable-json";
import { decryptString } from "@/lib/ai/keystore";
import { publishPageMediaPost, publishPagePost } from "@/lib/facebook/graph";
import { captureEvidence } from "@/lib/piltover/vnext/evidence-service";

const json = (value: unknown) => value as Prisma.InputJsonValue;

export type PublishingFailureCategory =
  | "RETRYABLE"
  | "RATE_LIMITED"
  | "AUTH_EXPIRED"
  | "VALIDATION_FAILED"
  | "PROVIDER_REJECTED"
  | "NETWORK"
  | "UNKNOWN";

export class PublishingProviderError extends Error {
  constructor(
    message: string,
    public readonly category: PublishingFailureCategory,
    public readonly retryAfterMs?: number,
    public readonly deliveryUnknown = false,
  ) {
    super(message);
    this.name = "PublishingProviderError";
  }
}

export interface PublishingProviderAdapter {
  id: string;
  constraints: PublishingProviderConstraint;
  publish(payload: unknown, context: {
    idempotencyKey: string;
    requestFingerprint: string;
  }): Promise<{ providerPostId: string; raw?: unknown }>;
}

const providerAdapters = new Map<string, PublishingProviderAdapter>();

export function registerPublishingProvider(adapter: PublishingProviderAdapter) {
  providerAdapters.set(adapter.id, adapter);
}

export function getPublishingProvider(id: string) {
  return providerAdapters.get(id) ?? null;
}


type StoredMediaDescriptor = {
  assetId?: string;
  sourceType?: string;
  mediaType?: string;
  fileName?: string | null;
  mimeType?: string | null;
  localPath?: string | null;
  sourceUrl?: string | null;
  sortOrder?: number;
};

export function googleDriveDirectUrl(sourceUrl: string) {
  const url = new URL(sourceUrl);
  if (url.protocol !== "https:" || !["drive.google.com", "docs.google.com"].includes(url.hostname)) {
    throw new PublishingProviderError("GOOGLE_DRIVE_HOST_INVALID", "VALIDATION_FAILED");
  }
  const pathMatch =
    url.pathname.match(/\/file\/d\/([^/]+)/) ??
    url.pathname.match(/\/(?:document|spreadsheets|presentation)\/d\/([^/]+)/) ??
    url.pathname.match(/\/d\/([^/]+)/);
  const id = pathMatch?.[1] ?? url.searchParams.get("id");
  if (!id) throw new PublishingProviderError("GOOGLE_DRIVE_FILE_ID_MISSING", "VALIDATION_FAILED");
  return `https://drive.google.com/uc?export=download&confirm=t&id=${encodeURIComponent(id)}`;
}

function remoteMediaLimits() {
  const maxBytesRaw = Number(process.env.PILTOVER_REMOTE_MEDIA_MAX_BYTES || 100 * 1024 * 1024);
  const timeoutRaw = Number(process.env.PILTOVER_REMOTE_MEDIA_TIMEOUT_MS || 30_000);
  return {
    maxBytes: Number.isFinite(maxBytesRaw) ? Math.max(1_048_576, Math.min(maxBytesRaw, 512 * 1024 * 1024)) : 100 * 1024 * 1024,
    timeoutMs: Number.isFinite(timeoutRaw) ? Math.max(1_000, Math.min(timeoutRaw, 120_000)) : 30_000,
  };
}

async function loadPublishingMedia(item: StoredMediaDescriptor) {
  const mimeType = item.mimeType || (item.mediaType === "VIDEO" ? "video/mp4" : "image/jpeg");
  const fileName = item.fileName || (item.mediaType === "VIDEO" ? "video.mp4" : "image.jpg");

  if (item.sourceType === "GOOGLE_DRIVE") {
    if (!item.sourceUrl) throw new PublishingProviderError("GOOGLE_DRIVE_URL_MISSING", "VALIDATION_FAILED");
    const limits = remoteMediaLimits();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), limits.timeoutMs);
    let response: Response;
    try {
      response = await fetch(googleDriveDirectUrl(item.sourceUrl), {
        redirect: "follow",
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new PublishingProviderError("GOOGLE_DRIVE_MEDIA_DOWNLOAD_TIMEOUT", "NETWORK");
      }
      throw new PublishingProviderError(
        error instanceof Error ? `GOOGLE_DRIVE_MEDIA_DOWNLOAD_FAILED:${error.message}` : "GOOGLE_DRIVE_MEDIA_DOWNLOAD_FAILED",
        "NETWORK",
      );
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      throw new PublishingProviderError(
        `GOOGLE_DRIVE_MEDIA_DOWNLOAD_FAILED:${response.status}`,
        response.status === 401 || response.status === 403 ? "AUTH_EXPIRED" : "NETWORK",
      );
    }
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (Number.isFinite(declaredLength) && declaredLength > limits.maxBytes) {
      throw new PublishingProviderError("GOOGLE_DRIVE_MEDIA_TOO_LARGE", "VALIDATION_FAILED");
    }
    const resolvedMime = response.headers.get("content-type") || mimeType;
    if (resolvedMime.includes("text/html")) {
      throw new PublishingProviderError(
        "GOOGLE_DRIVE_MEDIA_NOT_DIRECT_DOWNLOAD: hãy dùng link file được chia sẻ có quyền tải trực tiếp.",
        "VALIDATION_FAILED",
      );
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > limits.maxBytes) {
      throw new PublishingProviderError("GOOGLE_DRIVE_MEDIA_TOO_LARGE", "VALIDATION_FAILED");
    }
    return { bytes, mimeType: resolvedMime, fileName };
  }

  if (!item.localPath) throw new PublishingProviderError("LOCAL_MEDIA_PATH_MISSING", "VALIDATION_FAILED");
  const artifactRoot = process.env.LOCALAPPDATA
    ? path.resolve(process.env.LOCALAPPDATA, "Piltover", "artifacts")
    : path.resolve(process.cwd(), ".piltover", "artifacts");
  const candidate = path.resolve(item.localPath);
  if (!candidate.startsWith(artifactRoot + path.sep)) {
    throw new PublishingProviderError("LOCAL_MEDIA_PATH_INVALID", "VALIDATION_FAILED");
  }
  const bytes = new Uint8Array(await fs.readFile(candidate));
  return { bytes, mimeType, fileName };
}

async function resolvePublishingProvider(db: PrismaClient, id: string): Promise<PublishingProviderAdapter | null> {
  const registered = getPublishingProvider(id);
  if (registered) return registered;
  if (!id.startsWith("facebook:")) return null;
  const accountId = id.slice("facebook:".length);
  const account = await db.facebookAccount.findUnique({
    where: { id: accountId },
    include: {
      providerResource: {
        include: { connection: { select: { status: true, revokedAt: true } } },
      },
    },
  });
  if (!account) throw new PublishingProviderError("FACEBOOK_ACCOUNT_NOT_FOUND", "VALIDATION_FAILED");
  if (
    account.status === "REVOKED" ||
    account.providerResource?.status === "REVOKED" ||
    account.providerResource?.connection.revokedAt ||
    account.providerResource?.connection.status === "REVOKED"
  ) {
    throw new PublishingProviderError("PROVIDER_CONNECTION_REVOKED", "AUTH_EXPIRED");
  }
  if (account.tokenExpiresAt && account.tokenExpiresAt <= new Date()) {
    throw new PublishingProviderError("PROVIDER_AUTH_EXPIRED", "AUTH_EXPIRED");
  }
  return {
    id,
    constraints: {
      maxTextLength: 63206,
      maxHashtags: 30,
      supportedFormats: ["text", "image", "video", "carousel", "link"],
      maxMedia: 10,
    },
    async publish(payload) {
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new PublishingProviderError("FACEBOOK_PAYLOAD_INVALID", "VALIDATION_FAILED");
      }
      const record = payload as Record<string, unknown>;
      const message = typeof record.text === "string"
        ? record.text
        : typeof record.message === "string"
          ? record.message
          : "";
      if (!message.trim()) throw new PublishingProviderError("FACEBOOK_MESSAGE_REQUIRED", "VALIDATION_FAILED");
      const link = typeof record.link === "string" ? record.link : null;
      const media = Array.isArray(record.media)
        ? record.media.filter((item): item is StoredMediaDescriptor => Boolean(item && typeof item === "object"))
        : [];
      try {
        const result = media.length > 0
          ? await publishPageMediaPost(
              decryptString(account.accessToken),
              account.pageId,
              {
                message,
                media: await Promise.all(
                  [...media]
                    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                    .map(loadPublishingMedia),
                ),
              },
            )
          : await publishPagePost(decryptString(account.accessToken), account.pageId, { message, link });
        return { providerPostId: result.postId, raw: result.raw };
      } catch (error) {
        const message = error instanceof Error ? error.message : "FACEBOOK_PUBLISH_FAILED";
        const upper = message.toUpperCase();
        if (upper.includes("RATE") || upper.includes("429")) {
          throw new PublishingProviderError(message, "RATE_LIMITED");
        }
        if (upper.includes("TOKEN") || upper.includes("AUTH") || upper.includes("190")) {
          throw new PublishingProviderError(message, "AUTH_EXPIRED");
        }
        if (upper.includes("TIMEOUT") || upper.includes("NETWORK") || upper.includes("FETCH")) {
          throw new PublishingProviderError(message, "NETWORK", undefined, true);
        }
        throw new PublishingProviderError(message, "PROVIDER_REJECTED");
      }
    },
  };
}

export type PublishingProviderConstraint = {
  maxTextLength?: number;
  maxHashtags?: number;
  supportedFormats?: string[];
  maxMedia?: number;
};

export function validateProviderPayload(input: {
  text?: string; hashtags?: string[]; format?: string; media?: unknown[];
}, constraints: PublishingProviderConstraint) {
  const errors: string[] = [];
  if (constraints.maxTextLength && (input.text?.length ?? 0) > constraints.maxTextLength) errors.push("TEXT_TOO_LONG");
  if (constraints.maxHashtags && (input.hashtags?.length ?? 0) > constraints.maxHashtags) errors.push("TOO_MANY_HASHTAGS");
  if (constraints.supportedFormats?.length && input.format && !constraints.supportedFormats.includes(input.format)) errors.push("FORMAT_NOT_SUPPORTED");
  if (constraints.maxMedia && (input.media?.length ?? 0) > constraints.maxMedia) errors.push("TOO_MANY_MEDIA");
  return { ok: errors.length === 0, errors };
}

export function classifyPublishingFailure(error: unknown): {
  category: PublishingFailureCategory;
  retryAfterMs?: number;
  deliveryUnknown: boolean;
  message: string;
} {
  if (error instanceof PublishingProviderError) {
    return {
      category: error.category,
      retryAfterMs: error.retryAfterMs,
      deliveryUnknown: error.deliveryUnknown,
      message: error.message,
    };
  }
  const message = error instanceof Error ? error.message : "PUBLISH_FAILED";
  const upper = message.toUpperCase();
  if (upper.includes("NETWORK_AFTER_SEND") || upper.includes("AFTER_SEND")) {
    return { category: "UNKNOWN", deliveryUnknown: true, message };
  }
  if (upper.includes("RATE_LIMIT") || upper.includes("429")) {
    return { category: "RATE_LIMITED", deliveryUnknown: false, message };
  }
  if (upper.includes("AUTH") || upper.includes("TOKEN") || upper.includes("401")) {
    return { category: "AUTH_EXPIRED", deliveryUnknown: false, message };
  }
  if (upper.includes("VALIDATION") || upper.includes("CONSTRAINT") || upper.includes("PAYLOAD")) {
    return { category: "VALIDATION_FAILED", deliveryUnknown: false, message };
  }
  if (upper.includes("NETWORK") || upper.includes("TIMEOUT") || upper.includes("ECONN")) {
    return { category: "NETWORK", deliveryUnknown: false, message };
  }
  return { category: "UNKNOWN", deliveryUnknown: true, message };
}

function backoffMs(attemptNumber: number) {
  return Math.min(15 * 60_000, 5_000 * 2 ** Math.max(0, attemptNumber - 1));
}

export async function ensurePublishingJob(db: PrismaClient, input: {
  organizationId: string; brandId: string; contentVariantId: string; integrationId: string;
  scheduledAt?: Date | null; providerPayload: unknown; idempotencyMaterial: unknown; maxAttempts?: number;
}) {
  const idempotencyKey = "publish:" + stableHash(input.idempotencyMaterial);
  const existing = await db.publishingJob.findUnique({ where: { idempotencyKey } });
  if (existing) return existing;
  const payloadFingerprint = stableHash(input.providerPayload);
  const dueAt = input.scheduledAt ?? new Date();
  return db.publishingJob.create({
    data: {
      id: randomUUID(), organizationId: input.organizationId, brandId: input.brandId,
      contentVariantId: input.contentVariantId, integrationId: input.integrationId,
      scheduledAt: input.scheduledAt ?? null, providerPayload: json(input.providerPayload),
      payloadFingerprint, idempotencyKey, status: "QUEUED", maxAttempts: input.maxAttempts ?? 5,
      nextAttemptAt: dueAt,
    },
  });
}

export async function claimDuePublishingJobs(
  db: PrismaClient,
  input: { workerId: string; limit?: number; leaseMs?: number; now?: Date },
) {
  const now = input.now ?? new Date();
  const limit = Math.max(1, Math.min(input.limit ?? 10, 100));
  const leaseMs = Math.max(5_000, input.leaseMs ?? 60_000);

  await db.publishingJob.updateMany({
    where: {
      status: "RUNNING",
      leaseExpiresAt: { lte: now },
      providerPostId: null,
    },
    data: {
      status: "QUEUED",
      leaseOwner: null,
      leaseExpiresAt: null,
      errorCategory: "RETRYABLE",
      error: "LEASE_EXPIRED_RECLAIMED",
      nextAttemptAt: now,
    },
  });

  const candidates = await db.publishingJob.findMany({
    where: {
      status: { in: ["QUEUED", "RETRY_PENDING"] },
      providerPostId: null,
      AND: [
        { OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }] },
        { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
      ],
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
    take: limit * 3,
  });

  const claimed = [];
  for (const job of candidates) {
    if (claimed.length >= limit) break;
    const leaseExpiresAt = new Date(now.getTime() + leaseMs);
    const changed = await db.publishingJob.updateMany({
      where: { id: job.id, status: { in: ["QUEUED", "RETRY_PENDING"] }, leaseOwner: null },
      data: { status: "RUNNING", leaseOwner: input.workerId, leaseExpiresAt, startedAt: now },
    });
    if (changed.count === 1) {
      claimed.push(await db.publishingJob.findUniqueOrThrow({ where: { id: job.id } }));
    }
  }
  return claimed;
}

export async function markPublishingResult(db: PrismaClient, input: {
  jobId: string; providerPostId?: string | null; providerResponse?: unknown; error?: string | null;
}) {
  const current = await db.publishingJob.findUniqueOrThrow({ where: { id: input.jobId } });
  if (current.status === "COMPLETED") return current;
  return db.publishingJob.update({
    where: { id: input.jobId },
    data: {
      status: input.error ? "FAILED" : "COMPLETED",
      providerPostId: input.providerPostId ?? null,
      providerResponse: input.providerResponse === undefined ? undefined : json(input.providerResponse),
      errorCategory: input.error ? current.errorCategory : null,
      error: input.error ?? null,
      completedAt: input.error ? null : new Date(),
      leaseOwner: null,
      leaseExpiresAt: null,
      nextAttemptAt: null,
    },
  });
}

export async function reconcileUnknownPublishingJob(
  db: PrismaClient,
  input: {
    jobId: string;
    outcome: "CONFIRMED_PUBLISHED" | "CONFIRMED_NOT_PUBLISHED";
    providerPostId?: string | null;
    actorId?: string;
  },
) {
  const job = await db.publishingJob.findUniqueOrThrow({ where: { id: input.jobId } });
  if (job.status !== "UNKNOWN") throw new Error("PUBLISHING_JOB_NOT_UNKNOWN");
  if (input.outcome === "CONFIRMED_PUBLISHED" && !input.providerPostId?.trim()) {
    throw new Error("PROVIDER_POST_ID_REQUIRED");
  }

  const now = new Date();
  const updated = await db.publishingJob.update({
    where: { id: job.id },
    data: input.outcome === "CONFIRMED_PUBLISHED"
      ? {
          status: "COMPLETED", providerPostId: input.providerPostId!.trim(), error: null,
          errorCategory: null, blockedReason: null, completedAt: now, leaseOwner: null,
          leaseExpiresAt: null, nextAttemptAt: null,
        }
      : {
          status: "RETRY_PENDING", providerPostId: null, error: "CONFIRMED_NOT_PUBLISHED",
          errorCategory: "RETRYABLE", blockedReason: null, completedAt: null,
          leaseOwner: null, leaseExpiresAt: null, nextAttemptAt: now,
        },
  });

  await db.auditEntry.create({
    data: {
      id: randomUUID(), organizationId: job.organizationId, actorType: "HUMAN",
      actorId: input.actorId ?? "publishing-reconciler",
      action: input.outcome === "CONFIRMED_PUBLISHED"
        ? "PUBLISHING_RECONCILED_PUBLISHED"
        : "PUBLISHING_RECONCILED_NOT_PUBLISHED",
      targetType: "PUBLISHING_JOB", targetId: job.id, correlationId: job.idempotencyKey,
      metadata: json({ integrationId: job.integrationId, providerPostId: input.providerPostId ?? null }),
      occurredAt: now,
    },
  });
  return updated;
}

async function recordAttemptStart(
  db: PrismaClient,
  job: {
    id: string; attempts: number; providerPayload: Prisma.JsonValue; payloadFingerprint: string | null;
    integrationId: string; idempotencyKey: string;
  },
  workerId: string,
) {
  const attemptNumber = job.attempts + 1;
  const payloadFingerprint = job.payloadFingerprint ?? stableHash(job.providerPayload);
  const requestFingerprint = stableHash({
    integrationId: job.integrationId,
    payloadFingerprint,
    idempotencyKey: job.idempotencyKey,
  });
  return db.publishingAttempt.create({
    data: {
      id: randomUUID(),
      publishingJobId: job.id,
      attemptNumber,
      workerId,
      payloadFingerprint,
      requestFingerprint,
      status: "STARTED",
    },
  });
}

export async function executePublishingJob(
  db: PrismaClient,
  jobId: string,
  actor: { actorType: "HUMAN" | "AGENT" | "SYSTEM"; actorId: string } = { actorType: "SYSTEM", actorId: "publishing-engine" },
) {
  let job = await db.publishingJob.findUniqueOrThrow({ where: { id: jobId } });
  if (job.status === "COMPLETED") return job;
  if (job.status === "UNKNOWN") throw new Error("PUBLISHING_OUTCOME_REQUIRES_RECONCILIATION");
  if (job.status === "RUNNING" && job.leaseOwner && job.leaseOwner !== actor.actorId) {
    throw new Error("PUBLISHING_JOB_LEASED");
  }
  if (["BLOCKED", "DEAD"].includes(job.status)) throw new Error("PUBLISHING_JOB_REMEDIATION_REQUIRED");
  const now = new Date();
  if (job.scheduledAt && job.scheduledAt > now) throw new Error("PUBLISHING_NOT_DUE");
  if (job.nextAttemptAt && job.nextAttemptAt > now) throw new Error("PUBLISHING_RETRY_NOT_DUE");

  const adapter = await resolvePublishingProvider(db, job.integrationId);
  if (!adapter) throw new PublishingProviderError("PUBLISHING_PROVIDER_NOT_REGISTERED", "VALIDATION_FAILED");
  const validation = validateProviderPayload(job.providerPayload as never, adapter.constraints);
  if (!validation.ok) {
    await db.publishingJob.update({
      where: { id: job.id },
      data: {
        status: "BLOCKED", errorCategory: "VALIDATION_FAILED",
        error: "PROVIDER_CONSTRAINT_FAILED:" + validation.errors.join(","),
        blockedReason: "PAYLOAD_REMEDIATION_REQUIRED", leaseOwner: null, leaseExpiresAt: null,
      },
    });
    throw new PublishingProviderError("PROVIDER_CONSTRAINT_FAILED:" + validation.errors.join(","), "VALIDATION_FAILED");
  }

  if (job.status !== "RUNNING") {
    const claimed = await db.publishingJob.updateMany({
      where: { id: jobId, status: { in: ["QUEUED", "RETRY_PENDING", "FAILED"] }, leaseOwner: null },
      data: { status: "RUNNING", leaseOwner: actor.actorId, leaseExpiresAt: new Date(now.getTime() + 60_000), startedAt: now },
    });
    if (claimed.count !== 1) throw new Error("PUBLISHING_JOB_CLAIM_CONFLICT");
    job = await db.publishingJob.findUniqueOrThrow({ where: { id: jobId } });
  }

  const attempt = await recordAttemptStart(db, job, actor.actorId);
  await db.auditEntry.create({
    data: {
      id: randomUUID(), organizationId: job.organizationId, actorType: actor.actorType, actorId: actor.actorId,
      action: "PUBLISHING_EXECUTION_STARTED", targetType: "PUBLISHING_JOB", targetId: job.id,
      correlationId: job.idempotencyKey,
      metadata: json({
        integrationId: job.integrationId,
        payloadFingerprint: attempt.payloadFingerprint,
        requestFingerprint: attempt.requestFingerprint,
        attemptNumber: attempt.attemptNumber,
      }),
      occurredAt: now,
    },
  });

  try {
    const result = await adapter.publish(job.providerPayload, {
      idempotencyKey: job.idempotencyKey,
      requestFingerprint: attempt.requestFingerprint,
    });
    const finishedAt = new Date();
    await db.publishingAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "COMPLETED", providerPostId: result.providerPostId,
        providerResponse: result.raw === undefined ? undefined : json(result.raw), finishedAt,
      },
    });
    await db.publishingJob.update({
      where: { id: job.id },
      data: {
        attempts: { increment: 1 }, status: "COMPLETED", providerPostId: result.providerPostId,
        providerResponse: result.raw === undefined ? undefined : json(result.raw),
        errorCategory: null, error: null, blockedReason: null, completedAt: finishedAt,
        leaseOwner: null, leaseExpiresAt: null, nextAttemptAt: null,
      },
    });
    const completed = await db.publishingJob.findUniqueOrThrow({ where: { id: job.id } });
    await captureEvidence(db, {
      organizationId: job.organizationId, brandId: job.brandId, sourceType: "PUBLISHING_RESULT",
      sourceRef: `publishingJob:${job.id}`,
      content: {
        integrationId: job.integrationId, providerPostId: result.providerPostId,
        contentVariantId: job.contentVariantId, completedAt: completed.completedAt,
        requestFingerprint: attempt.requestFingerprint,
      },
      confidence: "provider-confirmed", freshness: "current", capturedAt: finishedAt,
      metadata: { idempotencyKey: job.idempotencyKey, attemptId: attempt.id },
    });
    await db.auditEntry.create({
      data: {
        id: randomUUID(), organizationId: job.organizationId, actorType: actor.actorType, actorId: actor.actorId,
        action: "PUBLISHING_COMPLETED", targetType: "PUBLISHING_JOB", targetId: job.id,
        correlationId: job.idempotencyKey,
        metadata: json({
          integrationId: job.integrationId, providerPostId: result.providerPostId,
          attemptId: attempt.id, requestFingerprint: attempt.requestFingerprint,
        }),
        occurredAt: finishedAt,
      },
    });
    return completed;
  } catch (error) {
    const failure = classifyPublishingFailure(error);
    const finishedAt = new Date();
    const attemptNumber = attempt.attemptNumber;
    const exhausted = attemptNumber >= job.maxAttempts;
    const retryable = ["RETRYABLE", "RATE_LIMITED", "NETWORK"].includes(failure.category) && !failure.deliveryUnknown;
    const retryAfterMs = failure.retryAfterMs ?? backoffMs(attemptNumber);
    const status = failure.deliveryUnknown
      ? "UNKNOWN"
      : failure.category === "AUTH_EXPIRED"
        ? "BLOCKED"
        : retryable && !exhausted
          ? "RETRY_PENDING"
          : exhausted
            ? "DEAD"
            : "BLOCKED";
    const blockedReason = status === "BLOCKED"
      ? failure.category === "AUTH_EXPIRED" ? "RECONNECT_PROVIDER" : "OPERATOR_REMEDIATION_REQUIRED"
      : status === "DEAD" ? "MAX_ATTEMPTS_EXHAUSTED" : null;
    await db.$transaction([
      db.publishingAttempt.update({
        where: { id: attempt.id },
        data: {
          status, errorCategory: failure.category, errorMessage: failure.message,
          retryAfterMs: retryable ? retryAfterMs : null, finishedAt,
        },
      }),
      db.publishingJob.update({
        where: { id: job.id },
        data: {
          attempts: { increment: 1 }, status, errorCategory: failure.category, error: failure.message,
          blockedReason, leaseOwner: null, leaseExpiresAt: null,
          nextAttemptAt: status === "RETRY_PENDING" ? new Date(finishedAt.getTime() + retryAfterMs) : null,
        },
      }),
      db.auditEntry.create({
        data: {
          id: randomUUID(), organizationId: job.organizationId, actorType: actor.actorType, actorId: actor.actorId,
          action: status === "UNKNOWN" ? "PUBLISHING_OUTCOME_UNKNOWN" : "PUBLISHING_ATTEMPT_FAILED",
          targetType: "PUBLISHING_JOB", targetId: job.id, correlationId: job.idempotencyKey,
          metadata: json({
            integrationId: job.integrationId, attemptId: attempt.id, requestFingerprint: attempt.requestFingerprint,
            category: failure.category, status, retryAfterMs: retryable ? retryAfterMs : null,
          }),
          occurredAt: finishedAt,
        },
      }),
    ]);
    throw error;
  }
}

export async function manualRetryPublishingJob(
  db: PrismaClient,
  input: { jobId: string; actorId: string },
) {
  const job = await db.publishingJob.findUniqueOrThrow({ where: { id: input.jobId } });
  if (job.status === "UNKNOWN") throw new Error("PUBLISHING_OUTCOME_REQUIRES_RECONCILIATION");
  if (job.status === "COMPLETED") return job;
  if (job.attempts >= job.maxAttempts) throw new Error("PUBLISHING_MAX_ATTEMPTS_EXHAUSTED");
  if (!["FAILED", "BLOCKED", "DEAD", "RETRY_PENDING"].includes(job.status)) {
    throw new Error("PUBLISHING_JOB_NOT_RETRYABLE");
  }
  const now = new Date();
  const updated = await db.publishingJob.update({
    where: { id: job.id },
    data: {
      status: "RETRY_PENDING", nextAttemptAt: now, blockedReason: null,
      error: null, errorCategory: null, leaseOwner: null, leaseExpiresAt: null,
    },
  });
  await db.auditEntry.create({
    data: {
      id: randomUUID(), organizationId: job.organizationId, actorType: "HUMAN", actorId: input.actorId,
      action: "PUBLISHING_MANUAL_RETRY", targetType: "PUBLISHING_JOB", targetId: job.id,
      correlationId: job.idempotencyKey, occurredAt: now,
    },
  });
  return updated;
}

export async function runPublishingSchedulerCycle(
  db: PrismaClient,
  input: { workerId: string; limit?: number; leaseMs?: number; now?: Date },
) {
  const claimed = await claimDuePublishingJobs(db, input);
  const groups = new Map<string, typeof claimed>();
  for (const job of claimed) {
    const key = job.integrationId || `job:${job.id}`;
    const group = groups.get(key) ?? [];
    group.push(job);
    groups.set(key, group);
  }

  // Different provider/page resources can publish in parallel. Jobs targeting the
  // same integration remain sequential to preserve ordering and avoid concurrent
  // mutations against the same Facebook Page/provider resource.
  const groupedResults = await Promise.all(
    [...groups.values()].map(async (jobs) => {
      const results: Array<{ jobId: string; status: string; error?: string }> = [];
      for (const job of jobs) {
        try {
          const result = await executePublishingJob(db, job.id, {
            actorType: "SYSTEM",
            actorId: input.workerId,
          });
          results.push({ jobId: job.id, status: result.status });
        } catch (error) {
          const latest = await db.publishingJob.findUniqueOrThrow({ where: { id: job.id } });
          results.push({
            jobId: job.id,
            status: latest.status,
            error: error instanceof Error ? error.message : "PUBLISH_FAILED",
          });
        }
      }
      return results;
    }),
  );
  return groupedResults.flat();
}
