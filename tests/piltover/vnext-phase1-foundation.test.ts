import { afterEach, describe, expect, it, vi } from "vitest";
import { createP3Fixture, type P3Fixture } from "./p3-test-db";
import {
  appendAgentMessage,
  createAgentThread,
  createCheckpoint,
  ensureAgentThread,
  getThreadStatus,
} from "../../lib/piltover/vnext/agent-thread-service";
import {
  registerPromptVersion,
  registerSkillVersion,
} from "../../lib/piltover/vnext/registry-service";
import { authorizeToolAction } from "../../lib/piltover/vnext/tool-policy";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

let fixture: P3Fixture | null = null;

afterEach(async () => {
  if (fixture) await fixture.database.dispose();
  fixture = null;
});

async function setup() {
  fixture = await createP3Fixture();
  return fixture;
}

describe("Piltover vNext phase 1 foundation", () => {
  it("keeps one persistent thread across messages and reloads", async () => {
    const { db } = await setup();
    const scope = {
      organizationId: "org-a",
      workspaceId: "workspace-a",
      brandId: "brand-a1",
      projectId: "brand-a1",
    };

    const first = await ensureAgentThread(db, scope, "thread-phase1");
    const second = await ensureAgentThread(db, scope, "thread-phase1");
    expect(second.id).toBe(first.id);

    await appendAgentMessage(db, {
      threadId: first.id,
      role: "user",
      content: { text: "Remember this context." },
    });
    await appendAgentMessage(db, {
      threadId: first.id,
      role: "agent",
      content: { text: "Context retained." },
    });
    const hydrated = await getThreadStatus(db, first.id);
    expect(hydrated?.messages.map((item) => item.role)).toEqual(["user", "agent"]);
    expect(hydrated?.messages).toHaveLength(2);
  });

  it("/new semantics create a different durable thread", async () => {
    const { db } = await setup();
    const scope = {
      organizationId: "org-a",
      workspaceId: "workspace-a",
      brandId: "brand-a1",
    };
    const first = await createAgentThread(db, scope);
    const next = await createAgentThread(db, scope);
    expect(next.id).not.toBe(first.id);
    expect((await db.agentThread.count())).toBe(2);
  });

  it("persists ordered checkpoints without changing thread identity", async () => {
    const { db } = await setup();
    const thread = await createAgentThread(db, {
      organizationId: "org-a",
      workspaceId: "workspace-a",
      brandId: "brand-a1",
    });
    const c1 = await createCheckpoint(db, thread.id, {
      stateSnapshot: { step: 1 },
      summary: "first",
    });
    const c2 = await createCheckpoint(db, thread.id, {
      stateSnapshot: { step: 2 },
      summary: "second",
    });

    expect(c1.sequence).toBe(1);
    expect(c2.sequence).toBe(2);
    const reloaded = await db.agentThread.findUnique({ where: { id: thread.id } });
    expect(reloaded?.id).toBe(thread.id);
    expect(reloaded?.activeCheckpointId).toBe(c2.id);
  });

  it("versions prompts and skills immutably", async () => {
    const { db } = await setup();
    const p1 = await registerPromptVersion(db, {
      key: "phase1-prompt",
      name: "Phase 1 Prompt",
      system: "v1",
      status: "PRODUCTION",
    });
    const p2 = await registerPromptVersion(db, {
      key: "phase1-prompt",
      name: "Phase 1 Prompt",
      system: "v2",
      status: "DRAFT",
    });
    expect(p1.version).toBe(1);
    expect(p2.version).toBe(2);
    expect((await db.promptVersion.findUnique({ where: { id: p1.id } }))?.system).toBe("v1");

    const s1 = await registerSkillVersion(db, {
      key: "phase1-skill",
      name: "Phase 1 Skill",
      domain: "agent",
      deterministicSteps: ["resolve-context"],
      status: "PRODUCTION",
    });
    const s2 = await registerSkillVersion(db, {
      key: "phase1-skill",
      name: "Phase 1 Skill",
      domain: "agent",
      deterministicSteps: ["resolve-context", "answer"],
      status: "DRAFT",
    });
    expect(s1.version).toBe(1);
    expect(s2.version).toBe(2);
  });

  it("denies missing tool grants and gates approval-required writes", async () => {
    const { db } = await setup();

    const denied = await authorizeToolAction(db, {
      organizationId: "org-a",
      workspaceId: "workspace-a",
      brandId: "brand-a1",
      toolNamespace: "publishing",
      action: "publish",
      mode: "write",
    });
    expect(denied).toEqual({ allowed: false, reason: "NO_GRANT" });
    await db.toolGrant.create({
      data: {
        id: "grant-publish",
        organizationId: "org-a",
        workspaceId: "workspace-a",
        brandId: "brand-a1",
        agentDefinitionId: null,
        toolNamespace: "publishing",
        action: "publish",
        canRead: true,
        canWrite: true,
        approvalRequired: true,
        status: "ACTIVE",
      },
    });

    const gated = await authorizeToolAction(db, {
      organizationId: "org-a",
      workspaceId: "workspace-a",
      brandId: "brand-a1",
      toolNamespace: "publishing",
      action: "publish",
      mode: "write",
    });
    expect(gated.allowed).toBe(false);
    if (!gated.allowed) expect(gated.reason).toBe("APPROVAL_REQUIRED");
  });
});
