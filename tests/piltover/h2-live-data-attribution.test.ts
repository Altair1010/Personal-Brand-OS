import { afterEach, describe, expect, it, vi } from "vitest";
import { createP3Fixture, type P3Fixture } from "./p3-test-db";
import { ensurePublishingJob, markPublishingResult } from "../../lib/piltover/vnext/publishing-engine";
import { createChannelVariant, createContentBrief, saveContentMaster } from "../../lib/piltover/vnext/content-engine";
import { ingestProviderMetricBatch, markSyncFailure, markSyncSuccess, syncFreshness } from "../../lib/piltover/vnext/live-data-engine";
import { resolveEvidenceRefs } from "../../lib/piltover/vnext/evidence-service";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });
let fixture: P3Fixture | null = null;
afterEach(async () => { if (fixture) await fixture.database.dispose(); fixture = null; });

async function setup() {
  fixture = await createP3Fixture();
  await fixture.db.userProfile.create({ data: { id: "local", name: "Local" } });
  await fixture.db.brandDNA.create({ data: { id: "dna-local", userId: "local", organizationId: "org-a", brandId: "brand-a1" } });
  const brief = await createContentBrief(fixture.db, { objective: "conversion", format: "text", channel: "facebook" });
  const saved = await saveContentMaster(fixture.db, { briefId: brief.id, payload: { schemaType: "TEXT_POST", data: { hook: "H", body: "B", cta: "C", hashtags: [] } } });
  const variant = await createChannelVariant(fixture.db, { contentMasterId: saved.master.id, channel: "facebook", format: "text", content: { text: "hello" } });
  return { db: fixture.db, master: saved.master, variant };
}

describe("H2.3 live data and attribution", () => {
  it("ingests provider facts deterministically with provenance and deduplication", async () => {
    const { db } = await setup();
    const observedAt = new Date("2026-09-22T10:00:00Z");
    const input = {
      organizationId: "org-a", workspaceId: "ws-a", brandId: "brand-a1", provider: "META",
      providerAccountRef: "acct-1", providerResourceRef: "page-1", providerEntityRef: "unlinked-post-1",
      facts: [
        { metricKey: "reach", value: 100, period: "2026-09-22", observedAt },
        { metricKey: "engagement", value: 20, period: "2026-09-22", observedAt },
      ],
    };
    const first = await ingestProviderMetricBatch(db, input);
    const second = await ingestProviderMetricBatch(db, input);
    expect(first.attributionStatus).toBe("UNLINKED");
    expect(first.snapshots[0]).toMatchObject({
      provider: "META", providerAccountRef: "acct-1", providerResourceRef: "page-1",
      providerEntityRef: "unlinked-post-1", attributionStatus: "UNLINKED",
    });
    expect((first.snapshots[0].metrics as Record<string, number>).engagement_rate).toBe(20);
    expect(await db.providerMetricObservation.count()).toBe(2);
    expect(second.snapshots[0].id).toBe(first.snapshots[0].id);
  });

  it("links a provider post only through an explicit PublishingJob", async () => {
    const { db, master, variant } = await setup();
    const job = await ensurePublishingJob(db, {
      organizationId: "org-a", brandId: "brand-a1", contentVariantId: variant.id, integrationId: "mock",
      providerPayload: { text: "hello" }, idempotencyMaterial: { variantId: variant.id, provider: "mock" },
    });
    await markPublishingResult(db, { jobId: job.id, providerPostId: "provider-post-1" });
    const result = await ingestProviderMetricBatch(db, {
      organizationId: "org-a", workspaceId: "ws-a", brandId: "brand-a1", provider: "META",
      providerAccountRef: "acct-1", providerEntityRef: "provider-post-1",
      facts: [{ metricKey: "reach", value: 42, period: "2026-09-22", observedAt: new Date("2026-09-22T11:00:00Z") }],
    });
    expect(result.attributionStatus).toBe("LINKED");
    expect(result.lineage).toMatchObject({ publishingJobId: job.id, channelVariantId: variant.id, contentMasterId: master.id });
  });

  it("surfaces fresh, stale and degraded sync states", async () => {
    const { db } = await setup();
    const now = new Date("2026-09-22T12:00:00Z");
    const fresh = await markSyncSuccess(db, {
      organizationId: "org-a", brandId: "brand-a1", provider: "META", dataset: "performance", cadenceMinutes: 60, now,
    });
    expect(syncFreshness(fresh, new Date("2026-09-22T12:30:00Z"))).toBe("FRESH");
    expect(syncFreshness(fresh, new Date("2026-09-22T13:01:00Z"))).toBe("STALE");
    const degraded = await markSyncFailure(db, {
      organizationId: "org-a", brandId: "brand-a1", provider: "META", dataset: "performance",
      errorCode: "RATE_LIMITED", errorMessage: "429", missingWindows: ["2026-09-22"], now: new Date("2026-09-22T13:02:00Z"),
    });
    expect(syncFreshness(degraded, new Date("2026-09-22T13:03:00Z"))).toBe("DEGRADED");
    expect(degraded.missingWindows).toEqual(["2026-09-22"]);
  });

  it("recommendation refs resolve both Evidence and PerformanceSnapshot IDs", async () => {
    const { db } = await setup();
    const result = await ingestProviderMetricBatch(db, {
      organizationId: "org-a", brandId: "brand-a1", provider: "META", providerAccountRef: "acct",
      providerEntityRef: "unlinked-post-2",
      facts: [{ metricKey: "reach", value: 10, period: "2026-09-22", observedAt: new Date("2026-09-22T11:00:00Z") }],
    });
    const snapshot = result.snapshots[0];
    const evidence = await db.evidence.findFirstOrThrow({ where: { sourceRef: `performance:${snapshot.id}` } });
    const resolved = await resolveEvidenceRefs(db, [`performance:${snapshot.id}`, `evidence:${evidence.id}`]);
    expect(resolved.snapshots.map((x) => x.id)).toContain(snapshot.id);
    expect(resolved.evidence.map((x) => x.id)).toContain(evidence.id);
  });
});
