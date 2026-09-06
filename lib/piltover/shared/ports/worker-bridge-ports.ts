import type { WorkerExecutionEnvelope } from "../contracts/worker-bridge";
import type { ExternalActor, WorkerTenantScope } from "./control-plane-ports";

export interface AuthenticatedWorkerPrincipal {
  readonly workerId: string;
  readonly credentialId: string;
}

export interface IssuedWorkerCredential extends AuthenticatedWorkerPrincipal {
  readonly credential: string;
  readonly expiresAt: Date;
}

export interface WorkerCredentialPort {
  issue(actor: ExternalActor, workerId: string, target: WorkerTenantScope, lifetimeMs: number, correlationId: string): Promise<IssuedWorkerCredential>;
  authenticate(credential: string): Promise<AuthenticatedWorkerPrincipal>;
  rotate(credential: string, overlapMs: number, lifetimeMs: number, correlationId: string): Promise<IssuedWorkerCredential>;
  revoke(actor: ExternalActor, credentialId: string, target: WorkerTenantScope, correlationId: string): Promise<void>;
}

export interface WorkerExecutionEnvelopePort {
  get(workerId: string, jobId: string, leaseId: string): Promise<WorkerExecutionEnvelope>;
}

export type CodexRuntimeEvent =
  | { readonly type: "MESSAGE_DELTA"; readonly text: string }
  | { readonly type: "EXECUTION_STARTED"; readonly threadId: string; readonly turnId: string }
  | { readonly type: "APPROVAL_REQUIRED"; readonly kind: string }
  | { readonly type: "COMPLETED"; readonly summary: string }
  | { readonly type: "FAILED"; readonly message: string };

export interface BoundedCodexExecution {
  readonly task: unknown;
  readonly repositoryPath: string;
  readonly correlationId: string;
}

export interface CodexExecutionHandle {
  readonly events: AsyncIterable<CodexRuntimeEvent>;
  interrupt(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface CodexRuntimePort {
  start(execution: BoundedCodexExecution): Promise<CodexExecutionHandle>;
}

export interface LocalRepositoryPort {
  resolve(alias: string): { readonly alias: string; readonly path: string };
}

export interface WorkerControlPlaneClientPort {
  heartbeat(): Promise<void>;
  poll(leaseDurationMs: number): Promise<{ claim: { job: { id: string; runId: string }; lease: { id: string } } | null }>;
  getExecutionEnvelope(jobId: string, leaseId: string): Promise<WorkerExecutionEnvelope>;
  markRunning(jobId: string, leaseId: string): Promise<void>;
  renew(jobId: string, leaseId: string, leaseDurationMs: number): Promise<void>;
  appendEvent(leaseId: string, event: unknown): Promise<void>;
  submitResult(jobId: string, leaseId: string, result: unknown): Promise<void>;
  reconnect(leases: readonly { jobId: string; leaseId: string }[], acknowledgements: readonly { runId: string; sequence: number }[]): Promise<{
    leases: readonly { jobId: string; leaseId: string; status: string }[];
  }>;
}
