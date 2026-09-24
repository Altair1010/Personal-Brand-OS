import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("UI/UX round 2 contracts", () => {
  it("keeps pending and destructive alerts readable", () => {
    const source = read("components/ErrorState.tsx");
    expect(source).toContain('bg-[#eadfc9]');
    expect(source).toContain('bg-[#ead5d1]');
    expect(source).toContain("isPendingAgentMessage");
    expect(source).toContain('role="alert"');
  });

  it("exposes stop, contextual handoff and slash command discovery in Agent chat", () => {
    const source = read("components/agent/AgentSidebar.tsx");
    expect(source).toContain('command: "/handoff"');
    expect(source).not.toContain('command: "/handoff-list"');
    expect(source).toContain("handleHandoffCommand");
    expect(source).toContain("analyzeHandoff");
    expect(source).toContain("stopActiveRun");
    expect(source).toContain("Agent Commands");
    expect(source).toContain("HANDOFF_STORAGE_KEY");
  });

  it("splits draft approval from Post creation", () => {
    const editor = read("components/content/DraftEditor.tsx");
    const actions = read("app/(dashboard)/studio/actions.ts");
    expect(editor).toContain("Duyệt");
    expect(editor).toContain("approveMutation.mutate()");
    expect(editor).toContain("Tạo Post");
    expect(actions).toContain("approveDraftOnly");
    expect(actions).toContain("createPostFromApprovedDraft");
  });

  it("maps strategy dates into calendar and opens Facebook-style composer", () => {
    const strategy = read("lib/strategy-engine/versioning.ts");
    const calendar = read("components/content/CalendarMonth.tsx");
    const composer = read("components/content/FacebookPostComposer.tsx");
    expect(strategy).toContain("goal.timeRangeStart");
    expect(strategy).toContain("date,");
    expect(calendar).toContain("FacebookPostComposer");
    expect(composer).toContain("Add image/video");
    expect(composer).toContain("Google Drive link");
    expect(composer).toContain("reorderCalendarAssets");
  });

  it("persists ordered content assets and resolves media at publishing time", () => {
    const schema = read("prisma/schema.prisma");
    const publishing = read("lib/piltover/vnext/publishing-engine.ts");
    const facebook = read("lib/facebook/graph.ts");
    expect(schema).toContain("model ContentAsset");
    expect(schema).toContain("@@index([contentDraftId, sortOrder])");
    expect(publishing).toContain("googleDriveDirectUrl");
    expect(publishing).toContain("loadPublishingMedia");
    expect(facebook).toContain("publishPageMediaPost");
  });

  it("campaign state migration accepts planning lifecycle", () => {
    const migration = read("prisma/migrations/20260923163500_fix_marketing_campaign_states/migration.sql");
    for (const state of ["DRAFT","PLANNING","READY","ACTIVE","PAUSED","COMPLETED","ARCHIVED"]) {
      expect(migration).toContain("'" + state + "'");
    }
  });

  it("parallel worker is bounded while queue serializes resource-coupled jobs", () => {
    const worker = read("scripts/piltover-openclaw-worker.ts");
    const queue = read("lib/piltover/modules/agents/infrastructure/prisma-job-queue.ts");
    expect(worker).toContain("MAX_CONCURRENCY");
    expect(worker).toContain("activeJobs");
    expect(queue).toContain("busyResources");
    expect(queue).toContain("executionPolicy(candidate.run.task, candidate.run.threadId)");
  });
});
