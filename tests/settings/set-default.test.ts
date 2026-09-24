import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");
const read = (relative: string) =>
  fs.readFileSync(path.join(root, relative), "utf8");

describe("settings AI routing and control plane", () => {
  it("removes API-key model configuration from the active Settings UI", () => {
    const page = read("app/(dashboard)/settings/page.tsx");
    const actions = read("app/(dashboard)/settings/actions.ts");

    expect(page).not.toContain("AiModelConfigForm");
    expect(page).toContain("AgentRoutingPanel");
    expect(page).toContain("ControlPlanePanel");
    expect(actions).not.toContain("saveModelConfig");
    expect(actions).not.toContain("setDefaultModelConfig");
    expect(actions).not.toContain("encryptString");
    expect(actions).not.toContain("resolveModelConfig");

    const legacyRunner = read("lib/ai/run.ts");
    expect(legacyRunner).toContain("DIRECT_MODEL_EXECUTION_DISABLED");
    expect(legacyRunner).not.toContain("resolveModelConfig");
    expect(legacyRunner).not.toContain("getAdapter(");
  });

  it("exposes agent-first routing and control-plane operational surfaces", () => {
    const actions = read("app/(dashboard)/settings/actions.ts");
    expect(actions).toContain('policy: "AGENT_FIRST"');
    expect(actions).toContain("Worker HTTP Bridge");
    expect(actions).toContain("OpenClaw Gateway");
    expect(actions).toContain("AI execution boundary");
    expect(actions).toContain("Brand DNA file intake");
    expect(actions).toContain("Working tree");
    expect(actions).toContain("Failed agent runs");
    expect(actions).toContain("workerDtos.map");
    expect(actions).toContain("futureSlots");
  });

  it("does not use direct model execution in active AI API routes", () => {
    const routes = [
      "audience",
      "brand-dna",
      "cta",
      "hook",
      "performance",
      "pillars",
      "post-writer",
      "revision",
      "strategy",
      "tone",
      "weekly-plan",
    ];
    for (const route of routes) {
      const source = read(`app/api/ai/${route}/route.ts`);
      expect(source).toContain("dispatchPromptModule");
      expect(source).not.toContain("runModule(");
      expect(source).not.toContain("resolveModelConfig");
    }
  });

  it("accepts Markdown uploads for Brand DNA source material", () => {
    const upload = read("app/api/upload/route.ts");
    const dropzone = read("components/brand/FileDropzone.tsx");
    expect(upload).toContain('name.endsWith(".md")');
    expect(upload).toContain('name.endsWith(".markdown")');
    expect(dropzone).toContain(".md,.markdown,.docx,.pdf");
  });
});
