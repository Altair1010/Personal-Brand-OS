import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PrismaJobQueue } from "@/lib/piltover/modules/agents/infrastructure/prisma-job-queue";
import { PrismaWorkerRegistry } from "@/lib/piltover/modules/workers/infrastructure/prisma-worker-registry";
import { googleDriveDirectUrl } from "@/lib/piltover/vnext/publishing-engine";
import { createP3Fixture, type P3Fixture } from "./p3-test-db";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

let fixture: P3Fixture | null = null;
afterEach(async () => {
  if (fixture) await fixture.database.dispose();
  fixture = null;
});

describe("Lane C QA / migration / safeguard contracts", () => {
  it("keeps slash-command routing exact and does not retain /handoff-list as an alias", () => {
    const source = read("components/agent/AgentSidebar.tsx");
    expect(source).toContain('{ command: "/handoff"');
    expect(source).not.toContain('{ command: "/handoff-list"');
    expect(source).toContain('/^\\/handoff(?:\\s|$)/i.test(message)');
    expect(source).toContain('if (message.startsWith("/") && message !== "/compact")');
    expect(source).toContain("LEGACY_HANDOFF_STORAGE_KEY");
    expect(source).toContain("window.localStorage.removeItem(LEGACY_HANDOFF_STORAGE_KEY)");
  });

  it("serializes the same resource while allowing an independent queued job to be claimed", async () => {
    fixture = await createP3Fixture();
    const queue = new PrismaJobQueue(fixture.db);
    const registry = new PrismaWorkerRegistry(fixture.db);
    await registry.register({
      schemaVersion: "1.0",
      workerId: "worker-lane-c",
      deviceName: "worker-lane-c",
      capabilities: ["git"],
      runtime: { adapter: "future-runtime", version: "1.0.0", protocolVersion: "1.0" },
    });
    await registry.grantWorkspace(fixture.ownerActor, "worker-lane-c", "workspace-a", "lane-c-grant");

    const makeRequest = (runId: string, policy: { mode: "parallel" | "sequential"; resourceKey: string | null }) => ({
      schemaVersion: "1.0" as const,
      runId,
      organizationId: "org-a",
      workspaceId: "workspace-a",
      brandId: null,
      roleRef: "role:lane-c@1",
      task: {
        type: "LANE_C",
        instruction: runId,
        executionPolicy: policy,
      },
      contextRef: { id: "ctx-" + runId, hash: "hash-" + runId },
      permissionManifestRef: "permission:lane-c",
      requiredCapabilities: ["git"],
      idempotencyKey: "idem-" + runId,
      priority: 70,
    });

    for (const [runId, policy] of [
      ["run-seq-1", { mode: "sequential", resourceKey: "strategy:brand-a1" }],
      ["run-seq-2", { mode: "sequential", resourceKey: "strategy:brand-a1" }],
      ["run-parallel", { mode: "parallel", resourceKey: null }],
    ] as const) {
      await queue.createRun(makeRequest(runId, policy), "correlation-" + runId);
      await queue.enqueue({
        runId,
        id: "job-" + runId,
        idempotencyKey: "job-" + runId,
        workspaceId: "workspace-a",
        requiredCapabilities: ["git"],
        maxAttempts: 2,
      });
    }

    const first = await queue.claimEligible("worker-lane-c", 60_000);
    expect(first?.job.id).toBe("job-run-seq-1");
    await queue.markRunning(first!.job.id, "worker-lane-c", first!.lease.id);

    const second = await queue.claimEligible("worker-lane-c", 60_000);
    expect(second?.job.id).toBe("job-run-parallel");
    await queue.markRunning(second!.job.id, "worker-lane-c", second!.lease.id);

    const third = await queue.claimEligible("worker-lane-c", 60_000);
    expect(third).toBeNull();
    expect((await fixture.db.job.findUniqueOrThrow({ where: { id: "job-run-seq-2" } })).status).toBe("QUEUED");
  }, 120_000);

  it("keeps the applied campaign lifecycle CHECK aligned and rejects an unknown state", async () => {
    fixture = await createP3Fixture();
    const ddl = await fixture.db.$queryRawUnsafe<Array<{ sql: string }>>(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='MarketingCampaign'",
    );
    const sql = ddl[0]?.sql ?? "";
    for (const state of ["DRAFT", "PLANNING", "READY", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]) {
      expect(sql).toContain("'" + state + "'");
    }

    const campaign = await fixture.db.marketingCampaign.create({
      data: {
        id: "lane-c-campaign",
        organizationId: "org-a",
        workspaceId: "workspace-a",
        brandId: "brand-a1",
        name: "Lane C",
        objective: "qa",
        channelMode: "MIXED",
        status: "DRAFT",
      },
    });
    expect(campaign.status).toBe("DRAFT");
    expect((await fixture.db.marketingCampaign.update({
      where: { id: campaign.id },
      data: { status: "PLANNING" },
    })).status).toBe("PLANNING");
    await expect(
      fixture.db.$executeRawUnsafe(
        "UPDATE MarketingCampaign SET status='UNKNOWN_STATE' WHERE id='lane-c-campaign'",
      ),
    ).rejects.toThrow();
  }, 120_000);

  it("binds Strategy -> Studio -> Campaign -> Calendar and keeps schedule precedence explicit", () => {
    const actions = read("app/(dashboard)/studio/actions.ts");
    const campaign = read("app/(dashboard)/campaigns/actions.ts");
    const calendar = read("components/content/CalendarMonth.tsx");
    const composer = read("components/content/FacebookPostComposer.tsx");

    expect(actions).toContain("activeStrategyId");
    expect(actions).toContain("weeklyPlans");
    expect(actions).toContain("dailyPlans");
    expect(actions).toContain("post?.delivery?.scheduledAt ?? d.date ?? dateForIndex");
    expect(campaign).toContain("scheduleOrganicPost");
    expect(campaign).toContain("ensurePublishingJob");
    expect(calendar).toContain("FacebookPostComposer");
    expect(composer).toContain("saveCalendarComposer");
    expect(composer).toContain("reorderCalendarAssets");
  });

  it("normalizes supported Drive links and rejects non-HTTPS or non-Google hosts", () => {
    for (const source of [
      "https://drive.google.com/file/d/file-123/view?usp=sharing",
      "https://docs.google.com/document/d/file-123/edit",
      "https://docs.google.com/spreadsheets/d/file-123/edit",
      "https://docs.google.com/presentation/d/file-123/edit",
      "https://drive.google.com/open?id=file-123",
    ]) {
      expect(googleDriveDirectUrl(source)).toBe(
        "https://drive.google.com/uc?export=download&confirm=t&id=file-123",
      );
    }
    expect(() => googleDriveDirectUrl("http://drive.google.com/file/d/file-123/view")).toThrow(
      "GOOGLE_DRIVE_HOST_INVALID",
    );
    expect(() => googleDriveDirectUrl("https://example.com/file/d/file-123/view")).toThrow(
      "GOOGLE_DRIVE_HOST_INVALID",
    );
    expect(() => googleDriveDirectUrl("https://drive.google.com/drive/folders/folder-123")).toThrow(
      "GOOGLE_DRIVE_FILE_ID_MISSING",
    );
  });

  it("guards scheduled remote asset download and preserves scheduler retry/idempotency contracts", () => {
    const engine = read("lib/piltover/vnext/publishing-engine.ts");
    const scheduler = read("lib/piltover/vnext/publishing-scheduler.ts");
    const worker = read("scripts/piltover-publishing-worker.ts");

    expect(engine).toContain("PILTOVER_REMOTE_MEDIA_MAX_BYTES");
    expect(engine).toContain("PILTOVER_REMOTE_MEDIA_TIMEOUT_MS");
    expect(engine).toContain("new AbortController()");
    expect(engine).toContain("GOOGLE_DRIVE_MEDIA_DOWNLOAD_TIMEOUT");
    expect(engine).toContain("GOOGLE_DRIVE_MEDIA_TOO_LARGE");
    expect(engine).toContain("payloadFingerprint");
    expect(engine).toContain("idempotencyKey");
    expect(engine).toContain("leaseExpiresAt");
    expect(engine).toContain("RETRY_PENDING");
    expect(scheduler).toContain("runAuthorizedPublishingSchedulerCycle");
    expect(scheduler).toContain("WAITING_APPROVAL");
    expect(worker).toContain("PILTOVER_PUBLISHING_POLL_MS");
    expect(worker).toContain("PILTOVER_PUBLISHING_LEASE_MS");
  });
});
