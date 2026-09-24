import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

type Database = PrismaClient | Prisma.TransactionClient;

export type ThreadScope = {
  organizationId: string;
  workspaceId: string;
  brandId: string;
  projectId?: string | null;
};

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function ensureAgentThread(
  db: Database,
  scope: ThreadScope,
  requestedId?: string | null,
) {
  if (requestedId) {
    const existing = await db.agentThread.findUnique({ where: { id: requestedId } });
    if (
      existing &&
      existing.organizationId === scope.organizationId &&
      existing.workspaceId === scope.workspaceId &&
      existing.brandId === scope.brandId &&
      existing.status === "ACTIVE"
    ) return existing;
  }

  return db.agentThread.create({
    data: {
      id: requestedId || randomUUID(),
      organizationId: scope.organizationId,
      workspaceId: scope.workspaceId,
      brandId: scope.brandId,
      projectId: scope.projectId ?? scope.brandId,
      state: json({}),
      memoryRefs: json([]),
      artifactRefs: json([]),
      participants: json([{ type: "human", id: "local" }]),
      status: "ACTIVE",
    },
  });
}

export async function createAgentThread(
  db: Database,
  scope: ThreadScope,
) {
  return ensureAgentThread(db, scope, randomUUID());
}

export async function createCheckpoint(
  db: PrismaClient,
  threadId: string,
  input: {
    runId?: string | null;
    stateSnapshot: unknown;
    pendingActions?: unknown;
    pendingApprovals?: unknown;
    summary?: string | null;
  },
) {
  return db.$transaction(async (tx) => {

    const last = await tx.agentCheckpoint.findFirst({
      where: { threadId },
      orderBy: { sequence: "desc" },
      select: { sequence: true },
    });
    const checkpoint = await tx.agentCheckpoint.create({
      data: {
        id: randomUUID(),
        threadId,
        runId: input.runId ?? null,
        sequence: (last?.sequence ?? 0) + 1,
        stateSnapshot: json(input.stateSnapshot),
        pendingActions: input.pendingActions === undefined ? undefined : json(input.pendingActions),
        pendingApprovals: input.pendingApprovals === undefined ? undefined : json(input.pendingApprovals),
        summary: input.summary ?? null,
      },
    });
    await tx.agentThread.update({
      where: { id: threadId },
      data: {
        activeCheckpointId: checkpoint.id,
        state: json(input.stateSnapshot),
      },
    });
    return checkpoint;
  });
}

export async function getThreadStatus(db: Database, threadId: string) {
  return db.agentThread.findUnique({
    where: { id: threadId },
    include: {
      checkpoints: { orderBy: { sequence: "desc" }, take: 1 },
      runs: {
        orderBy: { createdAt: "asc" },
        take: 100,
        select: {
          id: true,
          status: true,
          task: true,
          terminalResult: true,
          agentVersionId: true,
          promptVersionId: true,
          skillVersionRefs: true,
          modelRef: true,
          tokenUsage: true,
          costMinor: true,
          traceId: true,
          createdAt: true,
          completedAt: true,
        },
      },
      attachments: { orderBy: { createdAt: "desc" }, take: 20 },
      messages: { orderBy: { createdAt: "asc" }, take: 200 },
    },
  });
}

export async function appendAgentMessage(
  db: Database,
  input: {
    threadId: string;
    runId?: string | null;
    role: "user" | "agent" | "system" | "tool";
    content: unknown;
    metadata?: unknown;
  },
) {
  return db.agentMessage.create({
    data: {
      id: randomUUID(),
      threadId: input.threadId,
      runId: input.runId ?? null,
      role: input.role,
      content: json(input.content),
      metadata: input.metadata === undefined ? undefined : json(input.metadata),
    },
  });
}

export async function archiveThread(db: Database, threadId: string) {
  return db.agentThread.update({
    where: { id: threadId },
    data: { status: "ARCHIVED" },
  });
}
