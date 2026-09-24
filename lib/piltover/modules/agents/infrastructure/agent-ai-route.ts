import { db } from "@/lib/db";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";
import { AgentExecutionGateway, type AgentExecutionRoute } from "../application/agent-execution-gateway";
import { PrismaJobQueue } from "./prisma-job-queue";
import { stableHash } from "@/lib/piltover/shared/contracts/stable-json";
import type { PromptModule } from "@/lib/ai/run";
import { GLOBAL_CONTRACT } from "@/lib/ai/contract";
import { registerPromptVersion, registerSkillVersion, resolveProductionPrompt, resolveProductionSkill } from "@/lib/piltover/vnext/registry-service";

const REPOSITORY_ALIAS = "personal-brand-os";

function taskTypeFor(key: string): string {
  return `AI_ASSIST_${key.replace(/-/g, "_").toUpperCase()}`;
}

async function resolveRoute(): Promise<AgentExecutionRoute | null> {
  const workers = await db.worker.findMany({
    where: { status: "ACTIVE", lastSeenAt: { gt: new Date(Date.now() - 60_000) } },
    include: { capabilities: true },
    orderBy: { lastSeenAt: "desc" },
  });
  const openclaw = workers.find((worker) =>
    worker.capabilities.some(({ capability }) => capability === "agent.execute.openclaw"),
  );
  if (openclaw) {
    return {
      kind: "OPENCLAW",
      controller: "openclaw",
      support: {
        termius: openclaw.capabilities.some(({ capability }) => capability === "openclaw.support.termius"),
        router9: openclaw.capabilities.some(({ capability }) => capability === "openclaw.support.9router"),
      },
    };
  }
  const oauth = workers.find((worker) =>
    worker.capabilities.some(({ capability }) => capability === "agent.execute.oauth"),
  );
  return oauth ? { kind: "OAUTH", connector: oauth.runtimeAdapter } : null;
}

export async function dispatchPromptModule<I, O>(
  module: PromptModule<I, O>,
  rawInput: unknown,
) {
  const parsed = module.inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false as const, status: 400, error: parsed.error.issues };
  }
  const route = await resolveRoute();
  if (!route) {
    return {
      ok: false as const,
      status: 503,
      error: "AGENT_CONNECTOR_OFFLINE: connect an OpenClaw or OAuth worker first.",
    };
  }
  const tenant = await resolveLocalTenant(db);
  let promptVersion = await resolveProductionPrompt(db, module.key);
  if (!promptVersion) {
    promptVersion = await registerPromptVersion(db, {
      key: module.key,
      name: module.key,
      domain: "marketing",
      system: module.system,
      instructions: module.selfCheck,
      supportedModels: ["openclaw:configured", "oauth:configured"],
      status: "PRODUCTION",
    });
  }
  let skillVersion = await resolveProductionSkill(db, module.key);
  if (!skillVersion) {
    skillVersion = await registerSkillVersion(db, {
      key: module.key,
      name: module.key,
      domain: "marketing",
      promptRef: promptVersion.id,
      deterministicSteps: ["validate-input", "validate-output"],
      llmSteps: ["generate"],
      qualityGates: ["output-schema"],
      provenance: { source: "piltover-native", migratedFrom: "lib/prompts" },
      status: "PRODUCTION",
    });
  }
  const userPrompt = module.buildUser(parsed.data);
  const identityHash = stableHash({
    pipelineVersion: "agent-ai-route-v2",
    key: module.key,
    systemPrompt: module.system,
    resultContract: `${module.key}/v1`,
    input: parsed.data,
    organizationId: tenant.organizationId,
    brandId: tenant.brandId,
  });
  const dispatched = await new AgentExecutionGateway(new PrismaJobQueue(db)).dispatch({
    organizationId: tenant.organizationId,
    workspaceId: tenant.workspaceId,
    brandId: tenant.brandId,
    agentVersionId: `builtin:${module.key}:v1`,
    promptVersionId: promptVersion.id,
    skillVersionRefs: [skillVersion.id],
    modelRef: route.kind === "OPENCLAW" ? "openclaw:configured" : route.connector,
    traceId: `trace:${identityHash.slice(0, 24)}`,
    repositoryAlias: REPOSITORY_ALIAS,
    roleRef: `role:${module.key}@h1`,
    taskType: taskTypeFor(module.key),
    instruction:
      "Execute the supplied bounded AI-assist task through the configured Agent/OAuth route. Return one structured artifact matching the requested result contract. Do not use model API keys.",
    contextRef: { id: `ai-assist:${module.key}:${identityHash}`, hash: identityHash },
    permissionManifestRef: `permission:h1-ai-assist-${module.key}`,
    route,
    taskPayload: {
      moduleKey: module.key,
      systemPrompt: `${GLOBAL_CONTRACT}\n\n${module.system}`,
      userPrompt,
      input: parsed.data,
      resultContract: `${module.key}/v1`,
      artifactKind: `ai-assist-${module.key}-result`,
    },
    idempotencyKey: `h1-ai-assist:${module.key}:${identityHash}`,
    priority: 50,
    executionPolicy: { mode: "parallel", resourceKey: null },
  });
  return {
    ok: true as const,
    status: 202,
    data: {
      queued: true,
      runId: dispatched.runId,
      jobId: dispatched.jobId,
      agentStatus: dispatched.status,
      executionRoute: dispatched.route,
    },
  };
}
