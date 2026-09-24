import { afterEach, describe, expect, it, vi } from "vitest";
import { createP3Fixture, type P3Fixture } from "./p3-test-db";
import {
  claimDuePublishingJobs,
  ensurePublishingJob,
  executePublishingJob,
  manualRetryPublishingJob,
  PublishingProviderError,
  reconcileUnknownPublishingJob,
  registerPublishingProvider,
  runPublishingSchedulerCycle,
} from "../../lib/piltover/vnext/publishing-engine";
import { createChannelVariant, createContentBrief, saveContentMaster } from "../../lib/piltover/vnext/content-engine";
import { stableHash } from "../../lib/piltover/shared/contracts/stable-json";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });
let fixture: P3Fixture | null = null;
afterEach(async () => { if (fixture) await fixture.database.dispose(); fixture = null; });

async function setup() {
  fixture = await createP3Fixture();
  await fixture.db.userProfile.create({ data: { id: "local", name: "Local" } });
  await fixture.db.brandDNA.create({ data: { id: "dna-local", userId: "local", organizationId: "org-a", brandId: "brand-a1" } });
  const brief = await createContentBrief(fixture.db, { objective: "conversion", format: "text", channel: "facebook" });
  const saved = await saveContentMaster(fixture.db, {
    briefId: brief.id,
    payload: { schemaType: "TEXT_POST", data: { hook: "H", body: "B", cta: "C", hashtags: [] } },
  });
  const variant = await createChannelVariant(fixture.db, {
    contentMasterId: saved.master.id, channel: "facebook", format: "text", content: { text: "hello" },
  });
  return { db: fixture.db, variant };
}

describe("H2.2 durable publishing", () => {
  it("claims only due jobs and reclaims expired leases after restart", async () => {
    const { db, variant } = await setup();
    const now = new Date("2026-09-22T12:00:00Z");
    const future = await ensurePublishingJob(db, {
      organizationId: "org-a", brandId: "brand-a1", contentVariantId: variant.id, integrationId: "mock-due",
      scheduledAt: new Date(now.getTime() + 60_000), providerPayload: { text: "future" },
      idempotencyMaterial: { variantId: variant.id, slot: "future" },
    });
    const due = await ensurePublishingJob(db, {
      organizationId: "org-a", brandId: "brand-a1", contentVariantId: variant.id, integrationId: "mock-due",
      scheduledAt: new Date(now.getTime() - 1_000), providerPayload: { text: "due" },
      idempotencyMaterial: { variantId: variant.id, slot: "due" },
    });
    const claimed = await claimDuePublishingJobs(db, { workerId: "worker-a", now, leaseMs: 5_000 });
    expect(claimed.map((x) => x.id)).toEqual([due.id]);
    expect((await db.publishingJob.findUniqueOrThrow({ where: { id: future.id } })).status).toBe("QUEUED");

    const afterLease = new Date(now.getTime() + 6_000);
    const reclaimed = await claimDuePublishingJobs(db, { workerId: "worker-b", now: afterLease, leaseMs: 5_000 });
    expect(reclaimed.map((x) => x.id)).toContain(due.id);
    expect(reclaimed[0]?.leaseOwner).toBe("worker-b");
  });

  it("persists attempt ledger and provider result", async () => {
    const { db, variant } = await setup();
    registerPublishingProvider({
      id: "mock-success", constraints: { supportedFormats: ["text"] },
      async publish(_payload, context) { return { providerPostId: "post-1", raw: { requestFingerprint: context.requestFingerprint } }; },
    });
    const job = await ensurePublishingJob(db, {
      organizationId: "org-a", brandId: "brand-a1", contentVariantId: variant.id, integrationId: "mock-success",
      providerPayload: { text: "hello", format: "text" }, idempotencyMaterial: { variantId: variant.id, integrationId: "mock-success" },
    });
    const result = await executePublishingJob(db, job.id);
    expect(result).toMatchObject({ status: "COMPLETED", providerPostId: "post-1", attempts: 1 });
    const attempts = await db.publishingAttempt.findMany({ where: { publishingJobId: job.id } });
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ status: "COMPLETED", providerPostId: "post-1" });
    expect(attempts[0].payloadFingerprint).toBeTruthy();
    expect(attempts[0].requestFingerprint).toBeTruthy();
  });

  it("retries rate limit with Retry-After and never duplicates a completed job", async () => {
    const { db, variant } = await setup();
    let calls = 0;
    registerPublishingProvider({
      id: "mock-rate", constraints: {},
      async publish() {
        calls += 1;
        if (calls === 1) throw new PublishingProviderError("429", "RATE_LIMITED", 1_000);
        return { providerPostId: "post-rate-1" };
      },
    });
    const job = await ensurePublishingJob(db, {
      organizationId: "org-a", brandId: "brand-a1", contentVariantId: variant.id, integrationId: "mock-rate",
      providerPayload: { text: "hello" }, idempotencyMaterial: { variantId: variant.id, integrationId: "mock-rate" },
    });
    await expect(executePublishingJob(db, job.id)).rejects.toThrow("429");
    const retry = await db.publishingJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(retry).toMatchObject({ status: "RETRY_PENDING", errorCategory: "RATE_LIMITED", attempts: 1 });
    expect(retry.nextAttemptAt).not.toBeNull();
    await db.publishingJob.update({ where: { id: job.id }, data: { nextAttemptAt: new Date(Date.now() - 1) } });
    await runPublishingSchedulerCycle(db, { workerId: "worker-rate" });
    const completed = await db.publishingJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(completed).toMatchObject({ status: "COMPLETED", providerPostId: "post-rate-1", attempts: 2 });
    await executePublishingJob(db, job.id);
    expect(calls).toBe(2);
  });

  it("auth expiry blocks until operator remediation/manual retry", async () => {
    const { db, variant } = await setup();
    registerPublishingProvider({
      id: "mock-auth", constraints: {},
      async publish() { throw new PublishingProviderError("token expired", "AUTH_EXPIRED"); },
    });
    const job = await ensurePublishingJob(db, {
      organizationId: "org-a", brandId: "brand-a1", contentVariantId: variant.id, integrationId: "mock-auth",
      providerPayload: { text: "hello" }, idempotencyMaterial: { variantId: variant.id, integrationId: "mock-auth" },
    });
    await expect(executePublishingJob(db, job.id)).rejects.toThrow("token expired");
    expect(await db.publishingJob.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject({
      status: "BLOCKED", errorCategory: "AUTH_EXPIRED", blockedReason: "RECONNECT_PROVIDER",
    });
    const retry = await manualRetryPublishingJob(db, { jobId: job.id, actorId: "operator" });
    expect(retry.status).toBe("RETRY_PENDING");
  });

  it("payload fingerprint invalidates approval after payload mutation", async () => {
    const { db, variant } = await setup();
    const job = await ensurePublishingJob(db, {
      organizationId: "org-a", brandId: "brand-a1", contentVariantId: variant.id, integrationId: "mock-approval",
      providerPayload: { text: "approved payload" }, idempotencyMaterial: { variantId: variant.id, integrationId: "mock-approval" },
    });
    const approvedHash = stableHash(job.providerPayload);
    expect(approvedHash).toBe(job.payloadFingerprint);
    await db.publishingJob.update({ where: { id: job.id }, data: { providerPayload: { text: "changed payload" } } });
    const changed = await db.publishingJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(stableHash(changed.providerPayload)).not.toBe(approvedHash);
  });

  it("ambiguous after-send failure requires reconciliation before retry", async () => {
    const { db, variant } = await setup();
    registerPublishingProvider({
      id: "mock-unknown", constraints: {},
      async publish() { throw new PublishingProviderError("timeout after send", "UNKNOWN", undefined, true); },
    });
    const job = await ensurePublishingJob(db, {
      organizationId: "org-a", brandId: "brand-a1", contentVariantId: variant.id, integrationId: "mock-unknown",
      providerPayload: { text: "hello" }, idempotencyMaterial: { variantId: variant.id, integrationId: "mock-unknown" },
    });
    await expect(executePublishingJob(db, job.id)).rejects.toThrow("timeout after send");
    expect((await db.publishingJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("UNKNOWN");
    await expect(manualRetryPublishingJob(db, { jobId: job.id, actorId: "operator" })).rejects.toThrow("PUBLISHING_OUTCOME_REQUIRES_RECONCILIATION");
    const reconciled = await reconcileUnknownPublishingJob(db, {
      jobId: job.id, outcome: "CONFIRMED_PUBLISHED", providerPostId: "post-confirmed", actorId: "operator",
    });
    expect(reconciled).toMatchObject({ status: "COMPLETED", providerPostId: "post-confirmed" });
  });
});
