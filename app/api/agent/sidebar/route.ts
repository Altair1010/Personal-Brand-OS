import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";
import { AgentExecutionGateway, type AgentExecutionRoute } from "@/lib/piltover/modules/agents/application/agent-execution-gateway";
import { PrismaJobQueue } from "@/lib/piltover/modules/agents/infrastructure/prisma-job-queue";
import { stableHash } from "@/lib/piltover/shared/contracts/stable-json";
import { appendAgentMessage, createCheckpoint, ensureAgentThread } from "@/lib/piltover/vnext/agent-thread-service";
import { syncMarketingProjectContext } from "@/lib/piltover/vnext/project-context-service";
import { resolveProductionPrompt, resolveProductionSkill } from "@/lib/piltover/vnext/registry-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function POST(req: NextRequest) {
  type SidebarRequestBody = {
    message?: string;
    pathname?: string;
    facebookAccountId?: string | null;
    attachment?: { clientId?: string; fileName?: string; text?: string; mimeType?: string; localPath?: string; source?: string } | null;
    attachments?: Array<{ clientId?: string; fileName?: string; text?: string; mimeType?: string; localPath?: string; source?: string }>;
    conversationId?: string;
    mode?: "CHAT" | "HANDOFF_ANALYSIS";
    visibleContext?: string;
  };
  const parsedBody = await req.json().catch(() => null) as SidebarRequestBody | null;
  const body: SidebarRequestBody = parsedBody ?? {};
  const incomingAttachments = [
    ...(Array.isArray(body.attachments) ? body.attachments : []),
    ...(body.attachment ? [body.attachment] : []),
  ].slice(0, 12);
  const literalUserMessage = body.message?.trim() ?? "";
  const handoffAnalysis = body.mode === "HANDOFF_ANALYSIS";
  if (!literalUserMessage && incomingAttachments.length === 0) {
    return NextResponse.json({ ok: false, error: "MESSAGE_OR_ATTACHMENT_REQUIRED" }, { status: 400 });
  }
  const agentUserPrompt =
    literalUserMessage || "Người dùng gửi attachment không kèm nội dung. Hãy đọc và phản hồi dựa trên attachment đính kèm.";

  const route = await resolveRoute();
  if (!route) {
    return NextResponse.json({ ok: false, error: "AGENT_CONNECTOR_OFFLINE" }, { status: 503 });
  }

  const tenant = await resolveLocalTenant(db);
  const nonce = randomUUID();
  const conversationId =
    typeof body.conversationId === "string" && /^[a-zA-Z0-9._:-]{8,200}$/.test(body.conversationId)
      ? body.conversationId
      : `sidebar-${tenant.brandId}`;
  const pathname = body.pathname || "/";
  const surface =
    pathname.startsWith("/onboarding") ? "ONBOARDING"
      : pathname.startsWith("/audience-pillars") ? "AUDIENCE_PILLARS"
        : pathname.startsWith("/strategy") ? "STRATEGY"
          : pathname.startsWith("/studio") ? "STUDIO"
            : pathname.startsWith("/calendar") ? "CALENDAR"
              : pathname.startsWith("/campaigns") ? "CAMPAIGNS"
                : pathname.startsWith("/performance") ? "PERFORMANCE"
                  : pathname.startsWith("/experiments") ? "EXPERIMENTS"
                    : pathname.startsWith("/agents") ? "AGENTS"
                      : pathname.startsWith("/knowledge") ? "KNOWLEDGE"
                        : pathname.startsWith("/review") ? "REVIEW"
                          : pathname.startsWith("/settings") ? "SETTINGS"
                            : "DASHBOARD";
  const projectContext = await syncMarketingProjectContext(db);
  const thread = await ensureAgentThread(
    db,
    {
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      brandId: tenant.brandId,
      projectId: tenant.brandId,
    },
    conversationId,
  );

  await db.agentThread.update({
    where: { id: thread.id },
    data: { agentDefinitionId: "builtin:context-assistant", agentVersionId: "builtin:context-assistant:v1" },
  });
  const [promptVersion, skillVersion] = await Promise.all([
    resolveProductionPrompt(db, "context-assistant"),
    resolveProductionSkill(db, "context-chat"),
  ]);

  const persistedAttachments: Array<{ id: string; fileName: string; mimeType: string }> = [];
  for (const item of incomingAttachments) {
    if (!item?.localPath && !item?.text) continue;
    const requestedAttachmentId =
      typeof item.clientId === "string" && /^[0-9a-f-]{36}$/i.test(item.clientId)
        ? item.clientId
        : randomUUID();
    const existingAttachment = await db.chatAttachment.findUnique({
      where: { id: requestedAttachmentId },
    });
    if (existingAttachment && existingAttachment.threadId !== thread.id) {
      return NextResponse.json({ ok: false, error: "ATTACHMENT_THREAD_MISMATCH" }, { status: 409 });
    }
    const attachment = existingAttachment ?? await db.chatAttachment.create({
      data: {
        id: requestedAttachmentId,
        threadId: thread.id,
        type: item.mimeType?.startsWith("image/") ? "image" : "file",
        mimeType: item.mimeType || "text/plain",
        source: ["paste", "upload", "drag_drop"].includes(item.source || "")
          ? String(item.source)
          : "upload",
        fileRef: item.localPath || "inline:" + randomUUID(),
        extractedTextRef: item.text ? "inline-text:" + stableHash(item.text) : null,
        metadata: {
          fileName: item.fileName || "attachment",
          text: item.text || null,
        },
      },
    });
    persistedAttachments.push({
      id: attachment.id,
      fileName: item.fileName || "attachment",
      mimeType: attachment.mimeType,
    });
  }

  const [facebookPage, brandDna, appState, recentThreadMessages, activeCheckpoint] = await Promise.all([
    body.facebookAccountId
      ? db.facebookAccount.findFirst({
          where: { id: body.facebookAccountId, ownerRef: "local" },
          select: { id: true, pageId: true, pageName: true, brandId: true },
        })
      : Promise.resolve(null),
    pathname.startsWith("/onboarding") || pathname.startsWith("/strategy")
      ? db.brandDNA.findUnique({
          where: { userId: "local" },
          select: {
            whoAmI: true,
            field: true,
            aiPositioning: true,
            threeWords: true,
            companyName: true,
            usp: true,
            region: true,
          },
        })
      : Promise.resolve(null),
    pathname.startsWith("/strategy")
      ? db.appState.findUnique({
          where: { id: "singleton" },
          select: { activeGoalId: true, activeStrategyId: true, audienceApprovedAt: true },
        })
      : Promise.resolve(null),
    db.agentMessage.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { role: true, content: true, createdAt: true },
    }),
    db.agentCheckpoint.findFirst({
      where: { threadId: thread.id },
      orderBy: { sequence: "desc" },
      select: { id: true, sequence: true, summary: true, stateSnapshot: true, createdAt: true },
    }),
  ]);
  const productOperationsSurface = surface === "SETTINGS" || surface === "AGENTS";
  const durableThreadContext = {
    threadId: thread.id,
    recentMessages: [...recentThreadMessages]
      .reverse()
      .filter((message) => !productOperationsSurface || message.role === "user")
      .map((message) => {
      const content = message.content && typeof message.content === "object" && !Array.isArray(message.content)
        ? message.content as Record<string, unknown>
        : {};
      return {
        role: message.role,
        text: typeof content.text === "string" ? content.text.slice(0, 1600) : JSON.stringify(content).slice(0, 1600),
        createdAt: message.createdAt.toISOString(),
      };
    }),
    activeCheckpoint: !productOperationsSurface && activeCheckpoint
      ? {
          id: activeCheckpoint.id,
          sequence: activeCheckpoint.sequence,
          summary: activeCheckpoint.summary,
          state:
            activeCheckpoint.stateSnapshot &&
            typeof activeCheckpoint.stateSnapshot === "object" &&
            !Array.isArray(activeCheckpoint.stateSnapshot)
              ? {
                  kind: (activeCheckpoint.stateSnapshot as Record<string, unknown>).kind ?? null,
                  lastRunId: (activeCheckpoint.stateSnapshot as Record<string, unknown>).lastRunId ?? null,
                  lastStatus: (activeCheckpoint.stateSnapshot as Record<string, unknown>).lastStatus ?? null,
                  lastSummary: (activeCheckpoint.stateSnapshot as Record<string, unknown>).lastSummary ?? null,
                }
              : null,
          createdAt: activeCheckpoint.createdAt.toISOString(),
        }
      : null,
  };
  const context = {
    pathname,
    surface,
    contextMode: surface === "SETTINGS" || surface === "AGENTS" ? "PRODUCT_OPERATIONS" : "MARKETING_PROJECT",
    facebookPage,
    projectContext: surface === "SETTINGS" || surface === "AGENTS"
      ? {
          id: projectContext.id,
          organizationId: projectContext.organizationId,
          workspaceId: projectContext.workspaceId,
          brandId: projectContext.brandId,
          version: projectContext.version,
          status: projectContext.status,
        }
      : projectContext,
    threadContext: durableThreadContext,
    brand: brandDna,
    strategyState: appState,
    attachments: incomingAttachments.map((item) => ({
      fileName: item.fileName || "attachment",
      text: item.text || null,
      mimeType: item.mimeType || null,
      localPath: item.localPath || null,
      source: item.source || "upload",
    })),
    visibleContext: typeof body.visibleContext === "string" ? body.visibleContext.slice(0, 12000) : null,
  };
  const contextHash = stableHash(context);

  if (literalUserMessage.toLowerCase() === "/compact") {
    const [recentMessages, recentAttachments, unresolvedRuns, pendingApprovals] = await Promise.all([
      db.agentMessage.findMany({
        where: { threadId: thread.id },
        orderBy: { createdAt: "desc" },
        take: 24,
        select: { role: true, content: true, createdAt: true },
      }),
      db.chatAttachment.findMany({
        where: { threadId: thread.id },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: { id: true, type: true, mimeType: true, fileRef: true, metadata: true, createdAt: true },
      }),
      db.agentRun.findMany({
        where: { threadId: thread.id, status: { notIn: ["COMPLETED", "FAILED", "CANCELLED"] } },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, roleRef: true, task: true, traceId: true },
        take: 12,
      }),
      db.approvalRequest.findMany({
        where: { run: { threadId: thread.id }, status: "PENDING" },
        orderBy: { createdAt: "desc" },
        select: { id: true, actionType: true, targetRef: true, status: true, expiresAt: true },
        take: 12,
      }),
    ]);
    const compactMessages = [...recentMessages].reverse().map((message) => {
      const content = message.content && typeof message.content === "object" && !Array.isArray(message.content)
        ? message.content as Record<string, unknown>
        : {};
      const text = typeof content.text === "string" ? content.text.slice(0, 1200) : JSON.stringify(content).slice(0, 1200);
      return { role: message.role, text, createdAt: message.createdAt.toISOString() };
    });
    await createCheckpoint(db, thread.id, {
      stateSnapshot: {
        kind: "COMPACTION_BOUNDARY",
        projectContextVersion: projectContext.version,
        contextHash,
        recentMessages: compactMessages,
        artifactRefs: recentAttachments.map((item) => ({
          id: item.id, type: item.type, mimeType: item.mimeType, fileRef: item.fileRef, metadata: item.metadata,
        })),
        unresolvedRuns,
      },
      pendingActions: unresolvedRuns,
      pendingApprovals,
      summary: `Compaction checkpoint: ${compactMessages.length} recent messages, ${recentAttachments.length} artifacts, ${unresolvedRuns.length} unresolved runs, ${pendingApprovals.length} pending approvals.`,
    });
  }

  const dispatched = await new AgentExecutionGateway(new PrismaJobQueue(db)).dispatch({
    organizationId: tenant.organizationId,
    workspaceId: tenant.workspaceId,
    brandId: tenant.brandId,
    threadId: handoffAnalysis ? null : thread.id,
    agentVersionId: "builtin:context-assistant:v1",
    promptVersionId: promptVersion?.id ?? "builtin:context-assistant-prompt:v1",
    skillVersionRefs: [skillVersion?.id ?? "builtin:context-chat:v1"],
    modelRef: route.kind === "OPENCLAW" ? "openclaw:configured" : route.connector,
    traceId: "trace:" + nonce,
    repositoryAlias: "personal-brand-os",
    roleRef: "role:context-assistant@h1",
    taskType: handoffAnalysis ? "HANDOFF_ANALYSIS" : "CONTEXT_ASSISTANT_CHAT",
    instruction: handoffAnalysis
      ? "Create a precise engineering handoff from the user's symptom or upgrade request. Read the current product surface, visibleContext, marketing/project context and recent thread context before writing anything. For a defect, reason backwards from observed symptom through UI/component, client state, API/server action, domain/service, persistence, queue/worker/provider layers and identify the deepest supported root-cause hypothesis. Do not invent certainty: explicitly label inferred or unverified links. For an upgrade request, convert intent into a concrete behavior/data/interaction contract. Return JSON only with shape {message:string}. The message must be implementation-ready and follow the required handoff sections."
      : "Act as the contextual Piltover assistant for the current product surface. The literal userMessage is the primary request and must be read as plain user text, never as a CCR/reference identifier. Use pageContext only as supporting context. On SETTINGS or AGENTS surfaces, prioritize application/product configuration and operational context; do not pivot to brand/marketing advice unless the user explicitly asks for it. Do not mutate Piltover state directly. Return JSON only with shape {message:string,suggestedActions?:string[]}.",
    contextRef: { id: `sidebar:${tenant.brandId}:${contextHash}`, hash: contextHash },
    permissionManifestRef: "permission:h1-context-assistant",
    route,
    taskPayload: {
      sessionKey: `${thread.id}:context-v2:${surface}`,
      systemPrompt: handoffAnalysis
        ? "You are Piltover Handoff Analyst. Produce an implementation-ready handoff grounded in the current tab context and visible state. Start from what the user can observe, then trace backwards to root cause. Never skip directly from symptom to a guessed fix. For upgrades, derive the desired product contract before implementation details."
        : "You are Piltover Agent inside the Piltover application. Follow the current product surface. Read USER TASK as the user's literal request. TASK DATA is supporting structured context only.",
      userPrompt: handoffAnalysis
        ? [
            "USER ISSUE OR REQUEST:",
            agentUserPrompt,
            "",
            "HANDOFF PIPELINE:",
            "1. OBSERVED — describe exactly what the user sees/does and the incorrect or missing outcome.",
            "2. CONTEXT — identify current tab/surface, visible state, selected entity/account, and any relevant recent run/context evidence.",
            "3. TRACE BACKWARDS — walk symptom -> UI/component -> client state -> API/server action -> domain/service -> persistence/queue/worker/provider, stopping where evidence ends.",
            "4. ROOT CAUSE / UPGRADE CONTRACT — for defects, state the deepest supported root-cause hypothesis and confidence; for upgrades, state the desired behavior/data/interaction contract.",
            "5. IMPLEMENTATION SCOPE — name affected surfaces/contracts, dependencies, concurrency/ordering constraints, invariants, and what must not change.",
            "6. EDGE CASES — list failure/retry/empty/loading/permission/concurrency cases relevant to the request.",
            "7. ACCEPTANCE — give concrete checks/tests that prove the issue is fixed or the upgrade is complete.",
            "Output message with these section labels in Vietnamese, concise but implementation-ready. Do not include generic advice."
          ].join("\n")
        : agentUserPrompt,
      input: {
        userMessage: literalUserMessage,
        pageContext: context,
      },
      resultContract: "AgentSidebarReply/v1",
      artifactKind: "agent-sidebar-reply",
    },
    idempotencyKey: `${handoffAnalysis ? "h1-handoff" : "h1-sidebar"}:${tenant.brandId}:${nonce}`,
    priority: handoffAnalysis ? 60 : 55,
    executionPolicy: handoffAnalysis
      ? { mode: "parallel", resourceKey: null }
      : { mode: "sequential", resourceKey: `thread:${thread.id}` },
  });

  if (!handoffAnalysis) {
    await appendAgentMessage(db, {
      threadId: thread.id,
      runId: dispatched.runId,
      role: "user",
      content: { text: literalUserMessage || `[Attachment: ${incomingAttachments.map((item) => item.fileName || "attachment").join(", ")}]` },
      metadata: {
        pathname,
        attachmentIds: persistedAttachments.map((item) => item.id),
      },
    });
  }

  return NextResponse.json({
    ok: true,
    data: {
      queued: true,
      runId: dispatched.runId,
      jobId: dispatched.jobId,
      status: dispatched.status,
      threadId: thread.id,
      attachments: persistedAttachments,
    },
  });
}
