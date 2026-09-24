import { randomUUID } from "node:crypto";
import { db } from "../lib/db";
import { resolveLocalTenant } from "../lib/piltover/modules/marketing/infrastructure/local-tenant";
import { registerPromptVersion, registerSkillVersion } from "../lib/piltover/vnext/registry-service";

const refs = [
  ["gitroomhq/postiz-app", "AGPL-3.0", "architecture", "Provider adapter, scheduling, retry and idempotency patterns; no code copied."],
  ["brightbeanxyz/brightbean-studio", "VERIFY_CURRENT_LICENSE", "architecture", "RBAC, approval, audit and publishing permission reference."],
  ["inovector/mixpost", "MIT", "schema", "Social post, queue, calendar, template and media-library domain reference."],
  ["every-app/open-seo", "VERIFY_CURRENT_LICENSE", "architecture", "SEO/GEO provider and shared project-context reference."],
  ["KaiMOdev/trivium", "VERIFY_CURRENT_LICENSE", "concept", "Deterministic extractor → signal → rule → interpretation pattern."],
  ["crawfordxx/xiaoma-durex-copywriter", "VERIFY_CURRENT_LICENSE", "concept", "Creative reasoning, copy technique and visual grammar methodology."],
  ["aiworkskills/wechat-article-skills", "VERIFY_CURRENT_LICENSE", "concept", "Content-operation DAG reference."],
  ["msitarzewski/agency-agents", "VERIFY_CURRENT_LICENSE", "concept", "Quality gates and structured handoff reference."],
  ["crewAIInc/crewAI-examples", "VERIFY_CURRENT_LICENSE", "concept", "Orchestration reference only; CrewAI runtime not adopted."],
  ["shreyas-lyzr/marketing-agent", "VERIFY_CURRENT_LICENSE", "concept", "Marketing skill taxonomy donor."],
  ["ag-ui-protocol/ag-ui", "VERIFY_CURRENT_LICENSE", "architecture", "Agent ↔ frontend event protocol reference."],
  ["langchain-ai/langgraph", "MIT", "concept", "Thread/checkpoint/resume semantics reference; runtime not adopted."],
  ["CopilotKit/CopilotKit", "MIT", "concept", "Agent frontend and shared-state UX patterns."],
  ["langgenius/dify", "Apache-2.0", "concept", "Agent admin, prompt IDE and workflow UX reference."],
  ["langfuse/langfuse", "MIT/EE", "concept", "Prompt versioning, trace and evaluation reference."],
  ["pymc-labs/pymc-marketing", "Apache-2.0", "architecture", "External measurement-service methodology reference."],
  ["google/meridian", "Apache-2.0", "architecture", "Bayesian MMM and budget optimization reference."],
  ["facebookexperimental/Robyn", "MIT", "architecture", "MMM adstock/saturation reference."],
] as const;

const kpis = [
  ["reach", "Reach", "awareness", ["awareness"], "people", "sum"],
  ["impressions", "Impressions", "awareness", ["awareness"], "impressions", "sum"],
  ["engagement_rate", "Engagement rate", "engagement", ["engagement", "consideration"], "%", "weighted_average"],
  ["ctr", "CTR", "consideration", ["consideration", "lead_generation", "conversion"], "%", "weighted_average"],
  ["cpc", "CPC", "paid_media", ["consideration", "lead_generation", "conversion"], "VND", "weighted_average"],
  ["cpm", "CPM", "paid_media", ["awareness", "engagement"], "VND", "weighted_average"],
  ["cpa", "CPA", "conversion", ["conversion"], "VND", "weighted_average"],
  ["cpl", "CPL", "lead_generation", ["lead_generation"], "VND", "weighted_average"],
  ["roas", "ROAS", "conversion", ["conversion"], "x", "weighted_average"],
  ["revenue", "Revenue", "conversion", ["conversion", "retention"], "VND", "sum"],
  ["conversions", "Conversions", "conversion", ["conversion"], "count", "sum"],
  ["messages", "Messages", "lead_generation", ["lead_generation", "engagement"], "messages", "sum"],
  ["followers", "Followers", "audience", ["awareness", "engagement", "loyalty"], "people", "delta"],
  ["retention", "Retention", "retention", ["retention", "loyalty"], "%", "cohort"],
  ["ltv", "LTV", "retention", ["retention", "loyalty"], "VND", "weighted_average"],
] as const;

const techniques = [
  ["Contrast", "Place opposing states or expectations side by side."],
  ["SemanticHijack", "Reuse a familiar phrase or semantic frame with a brand-relevant shift."],
  ["ContextTransfer", "Move an idea into an unexpected but meaningful context."],
  ["ObjectVoice", "Let an object or artifact speak from its own perspective."],
  ["Wordplay", "Use language-specific ambiguity, rhythm or phonetics with locale adaptation."],
  ["StructuralDecomposition", "Break a concept into visible components, steps or layers."],
  ["CulturalReference", "Use a culturally recognizable reference only when audience/context justify it."],
  ["Understatement", "Create tension by deliberately reducing rather than exaggerating the claim."],
] as const;

async function main() {
  const tenant = await resolveLocalTenant(db);
  for (const [repo, license, importedAs, adaptation] of refs) {
    const exists = await db.importedPattern.findFirst({ where: { sourceRepo: repo, adaptation } });
    if (!exists) await db.importedPattern.create({ data: { id: randomUUID(), sourceRepo: repo, license, importedAs, adaptation } });
  }

  for (const [key, name, category, objectives, unit, aggregation] of kpis) {
    await db.kPIDefinition.upsert({
      where: { key },
      update: { name, category, supportedObjectives: objectives, defaultUnit: unit, aggregation },
      create: { id: randomUUID(), key, name, category, supportedObjectives: objectives, defaultUnit: unit, aggregation },
    });
  }

  for (const [name, mechanism] of techniques) {
    await db.copyTechnique.upsert({
      where: { name },
      update: { mechanism },
      create: {
        id: randomUUID(), name, mechanism, steps: ["identify tension", "apply mechanism", "check brand/audience fit"],
        localeAdapters: name === "Wordplay" ? { vi: "native Vietnamese wordplay required; never literal-translate Chinese puns" } : {},
        provenance: { source: "crawfordxx/xiaoma-durex-copywriter", importedAs: "methodology" },
      },
    });
  }

  const agentDefinitionId = "builtin:context-assistant";
  const agentVersionId = "builtin:context-assistant:v1";
  await db.agentDefinition.upsert({
    where: { id: agentDefinitionId },
    update: {
      name: "Context Assistant",
      description: "Persistent contextual assistant for Piltover product surfaces.",
      domain: "agent",
      currentVersionId: agentVersionId,
      modelPolicy: { route: "configured" },
      memoryPolicy: { thread: "persistent", checkpoint: true },
      toolPolicy: { default: "deny" },
      approvalPolicy: { writes: "grant-driven" },
      status: "ACTIVE",
    },
    create: {
      id: agentDefinitionId,
      name: "Context Assistant",
      description: "Persistent contextual assistant for Piltover product surfaces.",
      domain: "agent",
      currentVersionId: agentVersionId,
      modelPolicy: { route: "configured" },
      memoryPolicy: { thread: "persistent", checkpoint: true },
      toolPolicy: { default: "deny" },
      approvalPolicy: { writes: "grant-driven" },
      ownerScope: "PLATFORM",
      status: "ACTIVE",
    },
  });
  await db.agentDefinitionVersion.upsert({
    where: { definitionId_versionOrdinal: { definitionId: agentDefinitionId, versionOrdinal: 1 } },
    update: {},
    create: {
      id: agentVersionId,
      definitionId: agentDefinitionId,
      versionOrdinal: 1,
      baseRevision: 0,
      status: "PUBLISHED",
      specSchemaVersion: "1.0",
      semanticPayload: {
        promptKey: "context-assistant",
        skillKeys: ["context-chat"],
        runtime: "piltover-control-plane",
      },
      contentHash: "builtin-context-assistant-v1",
      publishedAt: new Date(),
    },
  });

  const prompt = await db.promptDefinition.findUnique({ where: { key: "context-assistant" } });
  if (!prompt) {
    await registerPromptVersion(db, {
      key: "context-assistant", name: "Context Assistant", domain: "agent",
      system: "Use MarketingProjectContext, evidence and current product surface. Never invent state mutations. Return concise operational assistance.",
      supportedModels: ["openclaw:configured"], status: "PRODUCTION",
    });
  }
  const skill = await db.skillDefinition.findUnique({ where: { key: "context-chat" } });
  if (!skill) {
    await registerSkillVersion(db, {
      key: "context-chat", name: "Contextual chat", domain: "agent",
      deterministicSteps: ["resolve thread", "resolve project context", "resolve attachments"],
      llmSteps: ["answer request"], tools: [], evaluators: ["contract"],
      qualityGates: ["json-contract"], provenance: { source: "piltover-native" }, status: "PRODUCTION",
    });
  }

  const canonicalAgents = [
    {
      key: "strategy-planner",
      name: "Strategy Planner",
      domain: "strategy",
      promptKey: "strategy-planner-h1",
      skillKey: "strategy-plan-30d",
      capability: "strategy.plan",
      system: "Create structured evidence-grounded marketing strategy plans from Piltover project context. Return only the requested output contract and never mutate product state directly.",
    },
    {
      key: "marketing-intelligence",
      name: "Marketing Intelligence",
      domain: "performance",
      promptKey: "marketing-intelligence-h1",
      skillKey: "marketing-intelligence-evidence",
      capability: "marketing.intelligence",
      system: "Analyze supplied marketing evidence only. Produce findings and recommendations with exact evidence references; never invent provider delivery or unsupported causal claims.",
    },
    {
      key: "strategy-revision",
      name: "Strategy Revision",
      domain: "strategy",
      promptKey: "strategy-revision-h1",
      skillKey: "strategy-revision-evidence",
      capability: "strategy.revise",
      system: "Propose structured strategy revisions from validated performance evidence. Preserve human approval boundaries and never apply the revision directly.",
    },
  ] as const;

  for (const agent of canonicalAgents) {
    const definitionId = `builtin:${agent.key}`;
    const versionId = `${definitionId}:v1`;

    const promptDefinition = await db.promptDefinition.findUnique({ where: { key: agent.promptKey } });
    if (!promptDefinition) {
      await registerPromptVersion(db, {
        key: agent.promptKey,
        name: agent.name,
        domain: agent.domain,
        system: agent.system,
        supportedModels: ["openclaw:configured"],
        status: "PRODUCTION",
      });
    }

    const skillDefinition = await db.skillDefinition.findUnique({ where: { key: agent.skillKey } });
    if (!skillDefinition) {
      await registerSkillVersion(db, {
        key: agent.skillKey,
        name: agent.name,
        domain: agent.domain,
        deterministicSteps: ["resolve project context", "validate input contract", "validate output contract"],
        llmSteps: ["execute bounded domain reasoning"],
        tools: [],
        evaluators: ["contract", "evidence"],
        qualityGates: ["schema", "evidence"],
        provenance: { source: "piltover-native" },
        status: "PRODUCTION",
      });
    }

    await db.agentDefinition.upsert({
      where: { id: definitionId },
      update: {
        name: agent.name,
        description: `Canonical Piltover ${agent.name} Agent.`,
        domain: agent.domain,
        currentVersionId: versionId,
        modelPolicy: { route: "configured" },
        memoryPolicy: { thread: "optional", checkpoint: true },
        toolPolicy: { default: "deny", capability: agent.capability },
        approvalPolicy: { writes: "human-controlled" },
        status: "ACTIVE",
      },
      create: {
        id: definitionId,
        name: agent.name,
        description: `Canonical Piltover ${agent.name} Agent.`,
        domain: agent.domain,
        currentVersionId: versionId,
        modelPolicy: { route: "configured" },
        memoryPolicy: { thread: "optional", checkpoint: true },
        toolPolicy: { default: "deny", capability: agent.capability },
        approvalPolicy: { writes: "human-controlled" },
        ownerScope: "PLATFORM",
        status: "ACTIVE",
      },
    });

    const prompt = await db.promptDefinition.findUniqueOrThrow({
      where: { key: agent.promptKey },
      include: { versions: { where: { status: "PRODUCTION" }, orderBy: { version: "desc" }, take: 1 } },
    });
    const skill = await db.skillDefinition.findUniqueOrThrow({
      where: { key: agent.skillKey },
      include: { versions: { where: { status: "PRODUCTION" }, orderBy: { version: "desc" }, take: 1 } },
    });

    await db.agentDefinitionVersion.upsert({
      where: { definitionId_versionOrdinal: { definitionId, versionOrdinal: 1 } },
      update: {
        semanticPayload: {
          promptKey: agent.promptKey,
          promptVersionId: prompt.versions[0]?.id ?? null,
          skillKeys: [agent.skillKey],
          skillVersionIds: skill.versions.map((item) => item.id),
          runtime: "piltover-control-plane",
        },
      },
      create: {
        id: versionId,
        definitionId,
        versionOrdinal: 1,
        baseRevision: 0,
        status: "PUBLISHED",
        specSchemaVersion: "1.0",
        semanticPayload: {
          promptKey: agent.promptKey,
          promptVersionId: prompt.versions[0]?.id ?? null,
          skillKeys: [agent.skillKey],
          skillVersionIds: skill.versions.map((item) => item.id),
          runtime: "piltover-control-plane",
        },
        contentHash: `builtin-${agent.key}-v1`,
        publishedAt: new Date(),
      },
    });
  }

  const grants = [
    ["project-context", "read", true, false, false],
    ["evidence", "read", true, false, false],
    ["content", "create", true, true, false],
    ["publishing", "publish", true, true, true],
    ["campaign", "budget-change", true, true, true],
  ] as const;
  for (const [namespace, action, canRead, canWrite, approvalRequired] of grants) {
    const existing = await db.toolGrant.findFirst({
      where: { organizationId: tenant.organizationId, agentDefinitionId: null, toolNamespace: namespace, action },
    });
    if (!existing) {
      await db.toolGrant.create({
        data: {
          id: randomUUID(), organizationId: tenant.organizationId, workspaceId: tenant.workspaceId, brandId: tenant.brandId,
          toolNamespace: namespace, action, canRead, canWrite, approvalRequired, status: "ACTIVE",
        },
      });
    }
  }
}

main().finally(() => db.$disconnect());
