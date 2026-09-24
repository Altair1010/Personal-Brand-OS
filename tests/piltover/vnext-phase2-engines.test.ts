import { afterEach, describe, expect, it, vi } from "vitest";
import { createP3Fixture, type P3Fixture } from "./p3-test-db";
import {
  createChannelVariant,
  createContentBrief,
  createCreativeTerritories,
  saveContentMaster,
} from "../../lib/piltover/vnext/content-engine";
import {
  ensurePublishingJob,
  executePublishingJob,
  markPublishingResult,
  registerPublishingProvider,
  reconcileUnknownPublishingJob,
  validateProviderPayload,
} from "../../lib/piltover/vnext/publishing-engine";
import { evaluateSeoSignals } from "../../lib/piltover/vnext/seo-engine";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });
let fixture: P3Fixture | null = null;
afterEach(async () => { if (fixture) await fixture.database.dispose(); fixture = null; });
async function setup() {
  fixture = await createP3Fixture();
  await fixture.db.userProfile.create({ data: { id: "local", name: "Local" } });
  await fixture.db.brandDNA.create({
    data: { id: "dna-local", userId: "local", organizationId: "org-a", brandId: "brand-a1" },
  });
  return fixture;
}

describe("Piltover vNext phase 2 engines", () => {
  it("persists edited ContentBrief dimensions and distinct creative mechanisms", async () => {
    const { db } = await setup();
    const brief = await createContentBrief(db, {
      objective: "conversion", format: "carousel", channel: "facebook",
      tone: "expert", intensity: "hard", hookDirection: "contrarian", length: "long",
    });
    expect(brief).toMatchObject({
      objective: "conversion", format: "carousel", intensity: "hard",
      hookDirection: "contrarian", length: "long",
    });
    const rows = await createCreativeTerritories(db, {
      briefId: brief.id,
      territories: [
        { insight: "A", mechanism: "Contrast" },
        { insight: "B", mechanism: "ObjectVoice" },
      ],
    });
    expect(new Set(rows.map((row) => row.mechanism)).size).toBe(2);
  });

  it("uses format-specific master schema and quality gate", async () => {
    const { db } = await setup();
    const brief = await createContentBrief(db, {
      objective: "engagement", format: "carousel", channel: "facebook",
    });
    const saved = await saveContentMaster(db, {
      briefId: brief.id,
      payload: {
        schemaType: "CAROUSEL",
        data: {
          cover: { headline: "Hook" },
          slides: [
            { headline: "One", body: "Body one" },
            { headline: "Two", body: "Body two" },
          ],
          finalSlide: { headline: "CTA", cta: "Comment" },
          caption: "Caption",
          hashtags: ["tiếng việt", "Piltover"],
        },
      },
    });
    expect(saved.master.schemaType).toBe("CAROUSEL");
    expect(saved.checks.normalizedHashtags).toEqual(["tiengviet", "Piltover"]);
    expect(await db.qualityGate.count({ where: { artifactId: saved.master.id } })).toBe(1);
  });

  it("keeps channel variants separate from ContentMaster", async () => {
    const { db } = await setup();
    const brief = await createContentBrief(db, {
      objective: "awareness", format: "text", channel: "facebook",
    });
    const saved = await saveContentMaster(db, {
      briefId: brief.id,
      payload: { schemaType: "TEXT_POST", data: { hook: "H", body: "B", cta: "C", hashtags: [] } },
    });
    const variant = await createChannelVariant(db, {
      contentMasterId: saved.master.id, channel: "linkedin", format: "text",
      content: { hook: "LinkedIn H", body: "LinkedIn B" },
    });
    const master = await db.contentMaster.findUniqueOrThrow({ where: { id: saved.master.id } });
    expect(variant.contentMasterId).toBe(master.id);
    expect((master.content as Record<string, unknown>).hook).toBe("H");
  });

  it("runs deterministic SEO facts without LLM scoring", () => {
    const findings = evaluateSeoSignals({
      title: null, description: null, h1Count: 0, imageCount: 2,
      imagesWithoutAlt: 1, internalLinks: 0, externalLinks: 0, wordCount: 80,
    });
    expect(findings.map((x) => x.code)).toEqual(expect.arrayContaining(["TITLE_MISSING", "H1_MISSING", "IMAGE_ALT_MISSING"]));
  });

  it("validates provider constraints deterministically", () => {
    expect(validateProviderPayload(
      { text: "123456", hashtags: ["a", "b"], format: "video" },
      { maxTextLength: 5, maxHashtags: 1, supportedFormats: ["text"] },
    )).toEqual({
      ok: false,
      errors: ["TEXT_TOO_LONG", "TOO_MANY_HASHTAGS", "FORMAT_NOT_SUPPORTED"],
    });
  });

  it("ambiguous provider failure becomes UNKNOWN and cannot be blindly retried", async () => {
    const { db } = await setup();
    const brief = await createContentBrief(db, { objective: "conversion", format: "text", channel: "facebook" });
    const saved = await saveContentMaster(db, {
      briefId: brief.id,
      payload: { schemaType: "TEXT_POST", data: { hook: "H", body: "B", cta: "C", hashtags: [] } },
    });
    const variant = await createChannelVariant(db, {
      contentMasterId: saved.master.id, channel: "facebook", format: "text", content: { text: "hello" },
    });
    registerPublishingProvider({
      id: "mock-ambiguous",
      constraints: { supportedFormats: ["text"] },
      async publish() { throw new Error("NETWORK_AFTER_SEND"); },
    });
    const job = await ensurePublishingJob(db, {
      organizationId: "org-a", brandId: "brand-a1", contentVariantId: variant.id,
      integrationId: "mock-ambiguous", providerPayload: { text: "hello", format: "text" },
      idempotencyMaterial: { variantId: variant.id, integrationId: "mock-ambiguous" },
    });
    await expect(executePublishingJob(db, job.id)).rejects.toThrow("NETWORK_AFTER_SEND");
    const unknown = await db.publishingJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(unknown.status).toBe("UNKNOWN");
    await expect(executePublishingJob(db, job.id)).rejects.toThrow("PUBLISHING_OUTCOME_REQUIRES_RECONCILIATION");
  });

  it("reconciles unknown publishing outcomes before a safe retry", async () => {
    const { db } = await setup();
    const brief = await createContentBrief(db, { objective: "conversion", format: "text", channel: "facebook" });
    const saved = await saveContentMaster(db, {
      briefId: brief.id,
      payload: { schemaType: "TEXT_POST", data: { hook: "H", body: "B", cta: "C", hashtags: [] } },
    });
    const variant = await createChannelVariant(db, {
      contentMasterId: saved.master.id, channel: "facebook", format: "text", content: { text: "hello" },
    });
    const job = await ensurePublishingJob(db, {
      organizationId: "org-a",
      brandId: "brand-a1",
      contentVariantId: variant.id,
      integrationId: "mock",
      providerPayload: { text: "hello" },
      idempotencyMaterial: { variantId: variant.id, integrationId: "mock" },
    });
    await db.publishingJob.update({ where: { id: job.id }, data: { status: "UNKNOWN", error: "network timeout" } });

    const retryable = await reconcileUnknownPublishingJob(db, {
      jobId: job.id,
      outcome: "CONFIRMED_NOT_PUBLISHED",
      actorId: "tester",
    });
    expect(retryable.status).toBe("RETRY_PENDING");

    await db.publishingJob.update({ where: { id: job.id }, data: { status: "UNKNOWN" } });
    await expect(reconcileUnknownPublishingJob(db, {
      jobId: job.id,
      outcome: "CONFIRMED_PUBLISHED",
      actorId: "tester",
    })).rejects.toThrow("PROVIDER_POST_ID_REQUIRED");

    const completed = await reconcileUnknownPublishingJob(db, {
      jobId: job.id,
      outcome: "CONFIRMED_PUBLISHED",
      providerPostId: "provider-confirmed-1",
      actorId: "tester",
    });
    expect(completed).toMatchObject({ status: "COMPLETED", providerPostId: "provider-confirmed-1" });
    expect(await db.auditEntry.count({ where: { targetType: "PUBLISHING_JOB", targetId: job.id } })).toBe(2);
  });

  it("publishing idempotency prevents duplicate jobs and completed result is stable", async () => {
    const { db } = await setup();
    const brief = await createContentBrief(db, { objective: "conversion", format: "text", channel: "facebook" });
    const saved = await saveContentMaster(db, {
      briefId: brief.id,
      payload: { schemaType: "TEXT_POST", data: { hook: "H", body: "B", cta: "C", hashtags: [] } },
    });
    const variant = await createChannelVariant(db, {
      contentMasterId: saved.master.id, channel: "facebook", format: "text", content: { text: "hello" },
    });
    const input = {
      organizationId: "org-a", brandId: "brand-a1", contentVariantId: variant.id,
      integrationId: "mock", providerPayload: { text: "hello" },
      idempotencyMaterial: { variantId: variant.id, integrationId: "mock" },
    };
    const first = await ensurePublishingJob(db, input);
    const retry = await ensurePublishingJob(db, input);
    expect(retry.id).toBe(first.id);
    const completed = await markPublishingResult(db, { jobId: first.id, providerPostId: "provider-1" });
    const again = await markPublishingResult(db, { jobId: first.id, providerPostId: "provider-2" });
    expect(completed.providerPostId).toBe("provider-1");
    expect(again.providerPostId).toBe("provider-1");
  });
});
