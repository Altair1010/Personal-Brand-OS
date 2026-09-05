import type { Approval, RunEvent, RunRequest, RunResult, WorkerRegistration } from "../contracts/control-plane";
import type { Capability } from "../../modules/identity/domain/rbac";

export interface ExternalActor {
  readonly provider: string;
  readonly subject: string;
}

export type WorkerTenantScope =
  | { readonly type: "WORKSPACE"; readonly id: string }
  | { readonly type: "BRAND"; readonly id: string };

export type ControlPlaneTenantScope =
  | { readonly type: "ORGANIZATION"; readonly id: string }
  | WorkerTenantScope;

export interface EnqueueJobCommand {
  readonly id: string;
  readonly runId: string;
  readonly idempotencyKey: string;
  readonly workspaceId?: string;
  readonly brandId?: string | null;
  readonly requiredCapabilities?: readonly string[];
  readonly priority?: number;
  readonly maxAttempts: number;
  readonly nextAttemptAt?: Date;
}

export interface ClaimedJob {
  readonly job: { readonly id: string; readonly runId: string; readonly attemptCount: number };
  readonly lease: {
    readonly id: string;
    readonly workerId: string;
    readonly attemptNumber: number;
    readonly expiresAt: Date;
  };
}

export interface JobQueuePort {
  createRun(request: RunRequest, correlationId: string): Promise<{ readonly id: string; readonly status: string }>;
  getRun(actor: ExternalActor, runId: string): Promise<{ readonly id: string; readonly status: string }>;
  enqueue(command: EnqueueJobCommand): Promise<{ readonly id: string; readonly status: string }>;
  claimEligible(workerId: string, leaseDurationMs: number): Promise<ClaimedJob | null>;
  markRunning(jobId: string, workerId: string, leaseId: string): Promise<void>;
  renewLease(jobId: string, workerId: string, leaseId: string, leaseDurationMs: number): Promise<Date>;
  reconcileExpiredLeases(retryDelayMs: number): Promise<number>;
  complete(jobId: string, workerId: string, leaseId: string, result: RunResult): Promise<void>;
  cancelRun(actor: ExternalActor, runId: string, correlationId: string): Promise<void>;
}

export type EventAuthority =
  | { readonly type: "SYSTEM"; readonly actorId: string }
  | { readonly type: "WORKER"; readonly workerId: string; readonly leaseId: string };

export interface RunEventPort {
  append(event: RunEvent, authority: EventAuthority): Promise<{ readonly runId: string; readonly sequence: number }>;
  readAfter(actor: ExternalActor, runId: string, afterSequence: number): Promise<readonly { readonly sequence: number }[]>;
}

export interface ApprovalRequestCommand {
  readonly id: string;
  readonly actionType: string;
  readonly targetRef: string;
  readonly target: ControlPlaneTenantScope;
  readonly payload: unknown;
  readonly requiredCapability: Capability;
  readonly expiresAt: Date;
  readonly oneTimeNonce?: string;
  readonly runId?: string;
  readonly correlationId: string;
}

export interface ApprovalPort {
  request(actor: ExternalActor, command: ApprovalRequestCommand): Promise<{ readonly id: string; readonly status: string }>;
  decide(actor: ExternalActor, approvalId: string, decision: "APPROVED" | "REJECTED", payload: unknown): Promise<{ readonly id: string; readonly status: string }>;
  consume(
    actor: ExternalActor,
    approvalId: string,
    binding: { readonly actionType: string; readonly targetRef: string; readonly payload: unknown },
    oneTimeNonce?: string,
  ): Promise<{ readonly id: string; readonly consumedAt: Date | null }>;
  cancel(actor: ExternalActor, approvalId: string): Promise<void>;
}

export interface WorkerReconnectCommand {
  readonly workerId: string;
  readonly capabilityVersion: number;
  readonly leases: readonly { readonly jobId: string; readonly leaseId: string }[];
  readonly acknowledgements: readonly { readonly runId: string; readonly sequence: number }[];
}

export interface WorkerReconnectPort {
  reconnect(command: WorkerReconnectCommand): Promise<{
    readonly workerStatus: string;
    readonly leases: readonly { readonly jobId: string; readonly leaseId: string; readonly status: string }[];
    readonly eventDeltas: readonly { readonly runId: string; readonly events: readonly { readonly sequence: number }[] }[];
    readonly runActions: readonly { readonly runId: string; readonly approvals: readonly { readonly id: string; readonly status: string }[] }[];
    readonly eligibleJobCount: number;
  }>;
}

export interface RegisteredWorker {
  readonly id: string;
  readonly status: "ACTIVE" | "DISABLED" | "REVOKED";
  readonly capabilities: readonly string[];
  readonly lastSeenAt: Date;
}

export interface WorkerRegistryPort {
  register(registration: WorkerRegistration, seenAt?: Date): Promise<RegisteredWorker>;
  get(workerId: string): Promise<RegisteredWorker | null>;
  heartbeat(workerId: string): Promise<void>;
  updateCapabilities(workerId: string, capabilities: readonly string[]): Promise<void>;
  disable(workerId: string, actorId: string, correlationId: string): Promise<void>;
  revoke(workerId: string, actorId: string, correlationId: string): Promise<void>;
  isAuthorized(workerId: string, scope: WorkerTenantScope): Promise<boolean>;
  grantWorkspace(actor: ExternalActor, workerId: string, workspaceId: string, correlationId: string): Promise<void>;
  revokeWorkspace(actor: ExternalActor, workerId: string, workspaceId: string, correlationId: string): Promise<void>;
  grantBrand(actor: ExternalActor, workerId: string, brandId: string, correlationId: string): Promise<void>;
  revokeBrand(actor: ExternalActor, workerId: string, brandId: string, correlationId: string): Promise<void>;
}
