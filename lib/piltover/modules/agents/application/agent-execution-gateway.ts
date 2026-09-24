import { z } from "zod";
import { stableHash } from "../../../shared/contracts/stable-json";
import type { JobQueuePort } from "../../../shared/ports/control-plane-ports";
import type { RunRequest } from "../../../shared/contracts/control-plane";

export const AgentExecutionRouteSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("OAUTH"),
    connector: z.string().trim().min(1),
  }).strict(),
  z.object({
    kind: z.literal("OPENCLAW"),
    controller: z.literal("openclaw"),
    support: z.object({
      termius: z.boolean().default(false),
      router9: z.boolean().default(false),
    }).strict(),
  }).strict(),
]);

export type AgentExecutionRoute = z.infer<typeof AgentExecutionRouteSchema>;

export interface DispatchAgentCommand {
  readonly organizationId: string;
  readonly workspaceId: string;
  readonly brandId?: string | null;
  readonly threadId?: string | null;
  readonly agentVersionId?: string | null;
  readonly promptVersionId?: string | null;
  readonly skillVersionRefs?: readonly string[];
  readonly modelRef?: string | null;
  readonly traceId?: string | null;
  readonly repositoryAlias: string;
  readonly roleRef: string;
  readonly taskType: string;
  readonly instruction: string;
  readonly contextRef: { readonly id: string; readonly hash: string };
  readonly permissionManifestRef: string;
  readonly route: AgentExecutionRoute;
  readonly taskPayload?: Readonly<Record<string, unknown>>;
  readonly idempotencyKey: string;
  readonly priority?: number;
  readonly requiredCapabilities?: readonly string[];
  readonly executionPolicy?: {
    readonly mode: "parallel" | "sequential";
    readonly resourceKey?: string | null;
  };
}

export interface DispatchedAgentRun {
  readonly runId: string;
  readonly jobId: string;
  readonly route: AgentExecutionRoute;
  readonly status: string;
}

export class AgentExecutionGateway {
  constructor(private readonly queue: JobQueuePort) {}

  async dispatch(input: DispatchAgentCommand): Promise<DispatchedAgentRun> {
    const route = AgentExecutionRouteSchema.parse(input.route);
    const identityHash = stableHash({
      idempotencyKey: input.idempotencyKey,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      brandId: input.brandId ?? null,
      taskType: input.taskType,
    });
    const runId = `agent-run-${identityHash.slice(0, 32)}`;
    const jobId = `agent-job-${identityHash.slice(0, 32)}`;
    const routeCapability =
      route.kind === "OAUTH" ? "agent.execute.oauth" : "agent.execute.openclaw";
    const requiredCapabilities = [
      routeCapability,
      ...(input.requiredCapabilities ?? []),
    ];

    const request: RunRequest = {
      schemaVersion: "1.0",
      runId,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      brandId: input.brandId ?? null,
      threadId: input.threadId ?? null,
      agentVersionId: input.agentVersionId ?? null,
      promptVersionId: input.promptVersionId ?? null,
      skillVersionRefs: [...(input.skillVersionRefs ?? [])],
      modelRef: input.modelRef ?? null,
      traceId: input.traceId ?? null,
      roleRef: input.roleRef,
      task: {
        type: input.taskType,
        instruction: input.instruction,
        executionRoute: route,
        executionPolicy: input.executionPolicy ?? {
          mode: input.threadId ? "sequential" : "parallel",
          resourceKey: input.threadId ? `thread:${input.threadId}` : null,
        },
        ...(input.taskPayload ?? {}),
        repositoryAlias: input.repositoryAlias,
      },
      contextRef: input.contextRef,
      permissionManifestRef: input.permissionManifestRef,
      requiredCapabilities,
      idempotencyKey: input.idempotencyKey,
      priority: input.priority ?? 50,
    };

    const run = await this.queue.createRun(request, `agent-dispatch:${runId}`);
    const effectiveRunId = run.id;
    const job = await this.queue.enqueue({
      id: jobId,
      runId: effectiveRunId,
      idempotencyKey: `job:${input.idempotencyKey}`,
      workspaceId: input.workspaceId,
      brandId: input.brandId ?? null,
      requiredCapabilities,
      priority: input.priority ?? 50,
      maxAttempts: 3,
    });

    return { runId: effectiveRunId, jobId: job.id, route, status: job.status || run.status };
  }
}
