import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { assertPromotionEvaluation } from "@/lib/piltover/vnext/evaluation-service";

const json = (value: unknown) => value as Prisma.InputJsonValue;

export async function resolveProductionPrompt(db: PrismaClient, key: string) {
  const prompt = await db.promptDefinition.findUnique({ where: { key } });
  if (!prompt) return null;
  return db.promptVersion.findFirst({
    where: { promptId: prompt.id, status: "PRODUCTION" },
    orderBy: { version: "desc" },
  });
}

export async function resolveProductionSkill(db: PrismaClient, key: string) {
  const skill = await db.skillDefinition.findUnique({ where: { key } });
  if (!skill) return null;
  return db.skillVersion.findFirst({
    where: { skillId: skill.id, status: "PRODUCTION" },
    orderBy: { version: "desc" },
  });
}

export async function registerPromptVersion(db: PrismaClient, input: {
  key: string; name: string; domain?: string; system: string; instructions?: string;
  inputSchema?: unknown; outputSchema?: unknown; supportedModels?: string[]; status?: string;
}) {
  return db.$transaction(async (tx) => {
    const prompt = await tx.promptDefinition.upsert({
      where: { key: input.key },
      update: { name: input.name, domain: input.domain ?? null },
      create: { id: randomUUID(), key: input.key, name: input.name, domain: input.domain ?? null },
    });
    const latest = await tx.promptVersion.findFirst({ where: { promptId: prompt.id }, orderBy: { version: "desc" } });
    return tx.promptVersion.create({
      data: {
        id: randomUUID(), promptId: prompt.id, version: (latest?.version ?? 0) + 1,
        system: input.system, instructions: input.instructions ?? null,
        inputSchema: input.inputSchema === undefined ? undefined : json(input.inputSchema),
        outputSchema: input.outputSchema === undefined ? undefined : json(input.outputSchema),
        supportedModels: json(input.supportedModels ?? []), status: input.status ?? "DRAFT",
      },
    });
  });
}

export async function registerSkillVersion(db: PrismaClient, input: {
  key: string; name: string; domain: string; description?: string; promptRef?: string;
  deterministicSteps?: unknown; llmSteps?: unknown; tools?: unknown; evaluators?: unknown;
  qualityGates?: unknown; provenance?: unknown; tests?: unknown; status?: string;
}) {
  return db.$transaction(async (tx) => {
    const skill = await tx.skillDefinition.upsert({
      where: { key: input.key },
      update: { name: input.name, domain: input.domain, description: input.description ?? null },
      create: { id: randomUUID(), key: input.key, name: input.name, domain: input.domain, description: input.description ?? null },
    });
    const latest = await tx.skillVersion.findFirst({ where: { skillId: skill.id }, orderBy: { version: "desc" } });
    return tx.skillVersion.create({
      data: {
        id: randomUUID(), skillId: skill.id, version: (latest?.version ?? 0) + 1,
        promptRef: input.promptRef ?? null,
        deterministicSteps: input.deterministicSteps === undefined ? undefined : json(input.deterministicSteps),
        llmSteps: input.llmSteps === undefined ? undefined : json(input.llmSteps),
        tools: input.tools === undefined ? undefined : json(input.tools),
        evaluators: input.evaluators === undefined ? undefined : json(input.evaluators),
        qualityGates: input.qualityGates === undefined ? undefined : json(input.qualityGates),
        provenance: input.provenance === undefined ? undefined : json(input.provenance),
        tests: input.tests === undefined ? undefined : json(input.tests), status: input.status ?? "DRAFT",
      },
    });
  });
}

export async function promotePromptVersion(db: PrismaClient, versionId: string) {
  const candidate = await db.promptVersion.findUnique({
    where: { id: versionId },
    include: { prompt: true },
  });
  if (!candidate) throw new Error("PROMPT_VERSION_NOT_FOUND");
  await assertPromotionEvaluation(db, {
    subjectType: "PROMPT_VERSION",
    subjectRef: candidate.prompt.key,
    candidateRef: candidate.id,
  });
  return db.$transaction(async (tx) => {
    await tx.promptVersion.updateMany({
      where: { promptId: candidate.promptId, status: "PRODUCTION", id: { not: candidate.id } },
      data: { status: "APPROVED" },
    });
    return tx.promptVersion.update({ where: { id: candidate.id }, data: { status: "PRODUCTION" } });
  });
}

export async function promoteSkillVersion(db: PrismaClient, versionId: string) {
  const candidate = await db.skillVersion.findUnique({
    where: { id: versionId },
    include: { skill: true },
  });
  if (!candidate) throw new Error("SKILL_VERSION_NOT_FOUND");
  await assertPromotionEvaluation(db, {
    subjectType: "SKILL_VERSION",
    subjectRef: candidate.skill.key,
    candidateRef: candidate.id,
  });
  return db.$transaction(async (tx) => {
    await tx.skillVersion.updateMany({
      where: { skillId: candidate.skillId, status: "PRODUCTION", id: { not: candidate.id } },
      data: { status: "APPROVED" },
    });
    return tx.skillVersion.update({ where: { id: candidate.id }, data: { status: "PRODUCTION" } });
  });
}
