import type { PrismaClient } from "@prisma/client";
import { resolveProductionPrompt, resolveProductionSkill } from "@/lib/piltover/vnext/registry-service";

export type CanonicalAgentKey =
  | "strategy-planner"
  | "marketing-intelligence"
  | "strategy-revision";

const CONFIG: Record<CanonicalAgentKey, {
  definitionId: string;
  promptKey: string;
  skillKeys: string[];
}> = {
  "strategy-planner": {
    definitionId: "builtin:strategy-planner",
    promptKey: "strategy-planner-h1",
    skillKeys: ["strategy-plan-30d"],
  },
  "marketing-intelligence": {
    definitionId: "builtin:marketing-intelligence",
    promptKey: "marketing-intelligence-h1",
    skillKeys: ["marketing-intelligence-evidence"],
  },
  "strategy-revision": {
    definitionId: "builtin:strategy-revision",
    promptKey: "strategy-revision-h1",
    skillKeys: ["strategy-revision-evidence"],
  },
};

export async function resolveCanonicalAgentBinding(
  db: PrismaClient,
  key: CanonicalAgentKey,
) {
  const config = CONFIG[key];
  const definition = await db.agentDefinition.findUnique({
    where: { id: config.definitionId },
  });
  if (!definition?.currentVersionId || definition.status !== "ACTIVE") {
    throw new Error(`CANONICAL_AGENT_VERSION_MISSING:${key}`);
  }

  const agentVersion = await db.agentDefinitionVersion.findUnique({
    where: { id: definition.currentVersionId },
  });
  if (!agentVersion || agentVersion.status !== "PUBLISHED") {
    throw new Error(`CANONICAL_AGENT_VERSION_NOT_PUBLISHED:${key}`);
  }

  const prompt = await resolveProductionPrompt(db, config.promptKey);
  if (!prompt) throw new Error(`CANONICAL_PROMPT_VERSION_MISSING:${config.promptKey}`);

  const skills = [];
  for (const skillKey of config.skillKeys) {
    const skill = await resolveProductionSkill(db, skillKey);
    if (!skill) throw new Error(`CANONICAL_SKILL_VERSION_MISSING:${skillKey}`);
    skills.push(skill);
  }

  return {
    agentVersionId: agentVersion.id,
    promptVersionId: prompt.id,
    skillVersionRefs: skills.map((skill) => skill.id),
  };
}
