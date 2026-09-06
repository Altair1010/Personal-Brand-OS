import type { RunEvent, RunResult } from "../../../shared/contracts/control-plane";
import type { AuthenticatedWorkerPrincipal } from "../../../shared/ports/worker-bridge-ports";
import type { JobQueuePort, RunEventPort, WorkerReconnectPort, WorkerRegistryPort } from "../../../shared/ports/control-plane-ports";
import type { WorkerExecutionEnvelopePort } from "../../../shared/ports/worker-bridge-ports";

export class AuthenticatedWorkerControlPlane {
  constructor(
    private readonly queue: JobQueuePort,
    private readonly registry: WorkerRegistryPort,
    private readonly events: RunEventPort,
    private readonly reconnectPort: WorkerReconnectPort,
    private readonly envelopes: WorkerExecutionEnvelopePort,
  ) {}

  private async assertActive(principal: AuthenticatedWorkerPrincipal): Promise<void> {
    const worker = await this.registry.get(principal.workerId);
    if (!worker || worker.status !== "ACTIVE") throw new Error("WORKER_DISABLED");
  }

  async heartbeat(principal: AuthenticatedWorkerPrincipal): Promise<{ status: "ACCEPTED" }> {
    await this.assertActive(principal);
    await this.registry.heartbeat(principal.workerId);
    return { status: "ACCEPTED" };
  }

  async poll(principal: AuthenticatedWorkerPrincipal, leaseDurationMs: number) {
    await this.assertActive(principal);
    return { claim: await this.queue.claimEligible(principal.workerId, leaseDurationMs) };
  }

  async envelope(principal: AuthenticatedWorkerPrincipal, jobId: string, leaseId: string) {
    return this.envelopes.get(principal.workerId, jobId, leaseId);
  }

  async markRunning(principal: AuthenticatedWorkerPrincipal, jobId: string, leaseId: string) {
    await this.queue.markRunning(jobId, principal.workerId, leaseId);
    return { status: "RUNNING" };
  }

  async renew(principal: AuthenticatedWorkerPrincipal, jobId: string, leaseId: string, leaseDurationMs: number) {
    return { expiresAt: await this.queue.renewLease(jobId, principal.workerId, leaseId, leaseDurationMs) };
  }

  async appendEvent(principal: AuthenticatedWorkerPrincipal, leaseId: string, event: RunEvent) {
    return this.events.append({ ...event, workerId: principal.workerId },
      { type: "WORKER", workerId: principal.workerId, leaseId });
  }

  async complete(principal: AuthenticatedWorkerPrincipal, jobId: string, leaseId: string, result: RunResult) {
    await this.queue.complete(jobId, principal.workerId, leaseId, result);
    return { status: "ACCEPTED" };
  }

  async reconnect(principal: AuthenticatedWorkerPrincipal, capabilityVersion: number,
    leases: readonly { jobId: string; leaseId: string }[], acknowledgements: readonly { runId: string; sequence: number }[]) {
    return this.reconnectPort.reconnect({ workerId: principal.workerId, capabilityVersion, leases, acknowledgements });
  }
}
