import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AgentExecutionGateway } from "@/lib/piltover/modules/agents/application/agent-execution-gateway";
import { PrismaJobQueue } from "@/lib/piltover/modules/agents/infrastructure/prisma-job-queue";
import { createDisposableP2Database, type DisposableP2Database } from "./p2-test-db";

describe("H1 agent execution gateway", () => {
  let database: DisposableP2Database;
  let gateway: AgentExecutionGateway;

  beforeAll(async () => {
    database = await createDisposableP2Database();
    const db = database.client;
    await db.userProfile.create({ data: { id: "local", name: "H1 Agent User" } });
    await db.organization.create({ data: { id: "org-h1-agent", name: "H1 Org" } });
    await db.workspace.create({
      data: {
        id: "wsp-h1-agent",
        organizationId: "org-h1-agent",
        name: "H1 Workspace",
      },
    });
    await db.brand.create({
      data: {
        id: "brand-h1-agent",
        organizationId: "org-h1-agent",
        workspaceId: "wsp-h1-agent",
        name: "H1 Brand",
      },
    });
    gateway = new AgentExecutionGateway(new PrismaJobQueue(db));
  }, 30_000);

  afterAll(async () => database.dispose());

  it("dispatches marketing intelligence through OpenClaw with Termius/9router as support metadata", async () => {
    const result = await gateway.dispatch({
      organizationId: "org-h1-agent",
      workspaceId: "wsp-h1-agent",
      brandId: "brand-h1-agent",
      repositoryAlias: "personal-brand-os",
      roleRef: "role:marketing-intelligence@h1",
      taskType: "MARKETING_INTELLIGENCE",
      instruction: "Analyze evidence.",
      contextRef: { id: "ctx-1", hash: "hash-1" },
      permissionManifestRef: "permission:h1-marketing-intelligence",
      route: {
        kind: "OPENCLAW",
        controller: "openclaw",
        support: { termius: true, router9: true },
      },
      taskPayload: { evidence: { sample: true } },
      idempotencyKey: "h1-agent-openclaw",
      requiredCapabilities: ["marketing.intelligence"],
    });

    const run = await database.client.agentRun.findUniqueOrThrow({
      where: { id: result.runId },
    });
    const job = await database.client.job.findUniqueOrThrow({
      where: { id: result.jobId },
    });

    expect(run.status).toBe("WAITING_FOR_WORKER");
    expect(run.task).toMatchObject({
      type: "MARKETING_INTELLIGENCE",
      repositoryAlias: "personal-brand-os",
      executionRoute: {
        kind: "OPENCLAW",
        controller: "openclaw",
        support: { termius: true, router9: true },
      },
    });
    expect(job.requiredCapabilities).toEqual([
      "agent.execute.openclaw",
      "marketing.intelligence",
    ]);
  });

  it("supports OAuth as an alternate agent execution route without model API semantics", async () => {
    const result = await gateway.dispatch({
      organizationId: "org-h1-agent",
      workspaceId: "wsp-h1-agent",
      brandId: "brand-h1-agent",
      repositoryAlias: "personal-brand-os",
      roleRef: "role:marketing-intelligence@h1",
      taskType: "MARKETING_INTELLIGENCE",
      instruction: "Analyze evidence.",
      contextRef: { id: "ctx-2", hash: "hash-2" },
      permissionManifestRef: "permission:h1-marketing-intelligence",
      route: { kind: "OAUTH", connector: "chatgpt-oauth" },
      idempotencyKey: "h1-agent-oauth",
      requiredCapabilities: ["marketing.intelligence"],
    });

    const job = await database.client.job.findUniqueOrThrow({
      where: { id: result.jobId },
    });
    expect(job.requiredCapabilities).toEqual([
      "agent.execute.oauth",
      "marketing.intelligence",
    ]);
  });

  it("is idempotent for the same execution request", async () => {
    const command = {
      organizationId: "org-h1-agent",
      workspaceId: "wsp-h1-agent",
      brandId: "brand-h1-agent",
      repositoryAlias: "personal-brand-os",
      roleRef: "role:marketing-intelligence@h1",
      taskType: "MARKETING_INTELLIGENCE",
      instruction: "Analyze evidence.",
      contextRef: { id: "ctx-3", hash: "hash-3" },
      permissionManifestRef: "permission:h1-marketing-intelligence",
      route: {
        kind: "OPENCLAW" as const,
        controller: "openclaw" as const,
        support: { termius: false, router9: false },
      },
      idempotencyKey: "h1-agent-idempotent",
      requiredCapabilities: ["marketing.intelligence"],
    };
    const a = await gateway.dispatch(command);
    const b = await gateway.dispatch(command);
    expect(b.runId).toBe(a.runId);
    expect(b.jobId).toBe(a.jobId);
  });
});
