import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Lane A UI and interaction contracts", () => {
  it("keeps errors readable in light and dark themes", () => {
    const source = read("components/ErrorState.tsx");
    expect(source).toContain('bg-[#ead5d1]');
    expect(source).toContain('text-[#552821]');
    expect(source).toContain('dark:bg-[#4a2927]');
    expect(source).toContain('dark:text-[#ffe9e5]');
  });

  it("exposes Agent stop and interrupts local polling", () => {
    const source = read("components/agent/AgentSidebar.tsx");
    expect(source).toContain("stoppedRunIdsRef");
    expect(source).toContain('command: "/stop"');
    expect(source).toContain("Agent sẽ không tiếp tục ghi kết quả");
    expect(source).toContain("stoppedRunIdsRef.current.has(runId)");
  });

  it("shows slash command discovery and contextual handoff command", () => {
    const source = read("components/agent/AgentSidebar.tsx");
    expect(source).toContain('command: "/handoff"');
    expect(source).not.toContain('command: "/handoff-list"');
    expect(source).toContain("Agent Commands");
    expect(source).toContain("handleHandoffCommand");
    expect(source).toContain("HANDOFF_STORAGE_KEY");
    expect(source).toContain("LEGACY_HANDOFF_STORAGE_KEY");
    expect(source).toContain("analyzeHandoff");
    expect(source).toContain("AGENT_COMMANDS.some(({ command }) => command === query)");
    expect(source).toContain("return AGENT_COMMANDS.filter(({ command }) => command.startsWith(query));");
    expect(source).toContain('event.key === "ArrowDown"');
    expect(source).toContain('event.key === "ArrowUp"');
  });

  it("keeps Review and Create Post as independent actions", () => {
    const source = read("components/content/DraftEditor.tsx");
    expect(source).toContain("approveMutation.mutate()");
    expect(source).toContain("createPostMutation.mutate()");
    expect(source).toMatch(/approveMutation\.mutate\(\)[\s\S]{0,700}Duyệt/);
    expect(source).toMatch(/createPostMutation\.mutate\(\)[\s\S]{0,700}Tạo Post/);
  });

  it("uses the supplied sidebar hero with fade overlays", () => {
    const source = read("components/layout/Sidebar.tsx");
    expect(source).toContain('/brand/sidebar-hero.webp');
    expect(source).toContain("bg-gradient-to-r");
    expect(source).toContain("bg-gradient-to-l");
    expect(fs.existsSync(path.join(root, "public/brand/sidebar-hero.webp"))).toBe(true);
  });

  it("aligns Campaign cards with shared flex layout", () => {
    const source = read("components/marketing/CampaignWorkspace.tsx");
    expect(source).toContain('grid items-stretch gap-5 xl:grid-cols-3');
    expect((source.match(/flex h-full min-h-\[430px\] flex-col overflow-hidden/g) ?? []).length).toBe(3);
    expect((source.match(/flex flex-1 flex-col gap-3 px-6 pb-6/g) ?? []).length).toBe(3);
  });
});
