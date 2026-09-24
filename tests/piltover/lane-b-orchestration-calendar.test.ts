import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Lane B orchestration contract", () => {
  it("keeps campaign status state machine aligned with the SQLite CHECK constraint", () => {
    const migration = read("prisma/migrations/20260923163500_fix_marketing_campaign_states/migration.sql");
    const domain = read("lib/piltover/modules/marketing/domain/h1-spine.ts");
    const service = read("lib/piltover/vnext/campaign-service.ts");
    for (const status of ["DRAFT", "PLANNING", "READY", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]) {
      expect(migration).toContain(`'${status}'`);
      expect(domain).toContain(`"${status}"`);
    }
    expect(domain).toContain('DRAFT: ["PLANNING", "ARCHIVED"]');
    expect(domain).toContain('PLANNING: ["READY", "DRAFT", "ARCHIVED"]');
    expect(service).toContain("CAMPAIGN_STATES = MARKETING_CAMPAIGN_STATES");
    expect(service).toContain("assertMarketingCampaignTransition");
  });

  it("serializes state-coupled strategy work but allows independent analysis in parallel", () => {
    const queue = read("lib/piltover/modules/agents/infrastructure/prisma-job-queue.ts");
    const strategy = read("app/(dashboard)/strategy/actions.ts");
    const review = read("app/(dashboard)/review/actions.ts");
    const performance = read("app/(dashboard)/performance/actions.ts");
    const aiRoute = read("lib/piltover/modules/agents/infrastructure/agent-ai-route.ts");
    const sidebarRoute = read("app/api/agent/sidebar/route.ts");

    expect(queue).toContain("busyResources");
    expect(queue).toContain('policy.mode === "sequential"');
    expect(queue).toContain("executionPolicy(run.task, run.threadId)");
    expect(strategy).toContain('mode: "sequential"');
    expect(strategy).toContain('resourceKey: `strategy:${tenant.brandId}`');
    expect(review).toContain('mode: "sequential"');
    expect(review).toContain('resourceKey: `strategy:${tenant.brandId}`');
    expect(performance).toContain('mode: "parallel"');
    expect(aiRoute).toContain('executionPolicy: { mode: "parallel", resourceKey: null }');
    expect(sidebarRoute).toContain("executionPolicy: handoffAnalysis");
    expect(sidebarRoute).toContain('? { mode: "parallel", resourceKey: null }');
    expect(sidebarRoute).toContain(': { mode: "sequential", resourceKey: `thread:${thread.id}` }');
  });

  it("routes /handoff through contextual Agent analysis without polluting normal thread messages", () => {
    const sidebar = read("components/agent/AgentSidebar.tsx");
    const route = read("app/api/agent/sidebar/route.ts");
    const container = read("components/layout/PageContainer.tsx");

    expect(container).toContain("data-piltover-page-context");
    expect(sidebar).toContain('document.querySelector<HTMLElement>("[data-piltover-page-context]")');
    expect(sidebar).toContain('mode: "HANDOFF_ANALYSIS"');
    expect(sidebar).toContain("symptom → context → root cause/upgrade contract");
    expect(sidebar).toContain("visibleText");
    expect(sidebar).toContain("alerts");
    expect(sidebar).toContain("controls");
    expect(sidebar).toContain("actions");
    expect(sidebar).toContain("[REDACTED]");
    expect(route).toContain('taskType: handoffAnalysis ? "HANDOFF_ANALYSIS"');
    expect(route).toContain("visibleContext");
    expect(route).toContain("threadId: handoffAnalysis ? null : thread.id");
    expect(route).toContain("HANDOFF PIPELINE:");
    expect(route).toContain("TRACE BACKWARDS");
    expect(route).toContain("ROOT CAUSE / UPGRADE CONTRACT");
    expect(route).toContain("EDGE CASES");
    expect(route).toContain("if (!handoffAnalysis)");
  });
});

describe("Lane B calendar and publishing contract", () => {
  it("binds Calendar to real delivery schedule and opens the Facebook composer", () => {
    const actions = read("app/(dashboard)/studio/actions.ts");
    const month = read("components/content/CalendarMonth.tsx");
    const day = read("components/content/DayCell.tsx");

    expect(actions).toContain("post?.delivery?.scheduledAt ?? d.date ?? dateForIndex");
    expect(actions).toContain("days.sort");
    expect(month).toContain("FacebookPostComposer");
    expect(month).toContain("onOpen={() => setSelected(day)}");
    expect(day).toContain("day.post?.scheduledAt");
  });

  it("supports ordered uploaded and Google Drive media in the Calendar composer", () => {
    const composer = read("components/content/FacebookPostComposer.tsx");
    const actions = read("app/(dashboard)/studio/actions.ts");

    expect(composer).toContain('accept="image/*,video/*"');
    expect(composer).toContain("Google Drive link");
    expect(composer).toContain("reorderCalendarAssets");
    expect(composer).toContain("removeCalendarAsset");
    expect(actions).toContain('z.enum(["UPLOAD", "GOOGLE_DRIVE"])');
    expect(actions).toContain("sortOrder");
    expect(actions).toContain('status: parsed.data.sourceType === "GOOGLE_DRIVE" ? "REMOTE" : "READY"');
  });

  it("refreshes a scheduled publishing job after caption, media or order edits", () => {
    const actions = read("app/(dashboard)/studio/actions.ts");
    expect(actions).toContain("async function syncScheduledPublishingPayload");
    expect(actions.match(/syncScheduledPublishingPayload\(/g)?.length ?? 0).toBeGreaterThanOrEqual(5);
    expect(actions).toContain("payloadFingerprint = stableHash(providerPayload)");
    expect(actions).toContain('status: { in: ["QUEUED", "RETRY_PENDING", "WAITING_APPROVAL", "BLOCKED"] }');
  });

  it("reschedules a post by updating its active publishing job instead of duplicating it", () => {
    const campaign = read("app/(dashboard)/campaigns/actions.ts");
    expect(campaign).toContain("const existingJob = await db.publishingJob.findFirst");
    expect(campaign).toContain("contentVariantId: post.id");
    expect(campaign).toContain("payloadFingerprint: stableHash(providerPayload)");
    expect(campaign).toContain("idempotencyMaterial: {");
    expect(campaign).toContain("postId: post.id");
    expect(campaign).toContain("integrationId");
  });

  it("downloads Google Drive media at publish time and preserves media order", () => {
    const engine = read("lib/piltover/vnext/publishing-engine.ts");
    expect(engine).toContain("function googleDriveDirectUrl");
    expect(engine).toContain('["drive.google.com", "docs.google.com"]');
    expect(engine).toContain("confirm=t");
    expect(engine).toContain('item.sourceType === "GOOGLE_DRIVE"');
    expect(engine).toContain("await fetch(googleDriveDirectUrl(item.sourceUrl)");
    expect(engine).toContain(".sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))");
    expect(engine).toContain("publishPageMediaPost");
  });

  it("publishes independent provider resources in parallel while preserving per-integration order", () => {
    const engine = read("lib/piltover/vnext/publishing-engine.ts");
    expect(engine).toContain("const groups = new Map");
    expect(engine).toContain("job.integrationId");
    expect(engine).toContain("Promise.all");
    expect(engine).toContain("for (const job of jobs)");
  });
});
