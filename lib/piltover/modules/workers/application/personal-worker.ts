import type { CodexRuntimeEvent, CodexRuntimePort, LocalRepositoryPort, WorkerControlPlaneClientPort } from "../../../shared/ports/worker-bridge-ports";

export interface PersonalWorkerPolicy {
  readonly leaseDurationMs: number;
  readonly authorityCheckIntervalMs: number;
}

export class PersonalWorker {
  constructor(
    private readonly controlPlane: WorkerControlPlaneClientPort,
    private readonly repositories: LocalRepositoryPort,
    private readonly runtime: CodexRuntimePort,
    private readonly policy: PersonalWorkerPolicy,
  ) {}

  async executeOnce(): Promise<"IDLE" | "COMPLETED" | "FAILED" | "AUTHORITY_LOST"> {
    await this.controlPlane.heartbeat();
    const { claim } = await this.controlPlane.poll(this.policy.leaseDurationMs);
    if (!claim) return "IDLE";
    const { id: jobId, runId } = claim.job;
    const leaseId = claim.lease.id;
    const envelope = await this.controlPlane.getExecutionEnvelope(jobId, leaseId);
    const repository = this.repositories.resolve(envelope.repositoryAlias);
    await this.controlPlane.markRunning(jobId, leaseId);
    const handle = await this.runtime.start({ task: envelope.task, repositoryPath: repository.path, correlationId: envelope.correlationId });
    let sequence = 0;
    let terminal: CodexRuntimeEvent | null = null;
    const iterator = handle.events[Symbol.asyncIterator]();
    let pendingEvent = iterator.next();
    let authorityTimer: ReturnType<typeof setTimeout> | undefined;
    const nextAuthorityCheck = () => new Promise<{ type: "CHECK" }>((resolve) => {
      authorityTimer = setTimeout(() => resolve({ type: "CHECK" }), this.policy.authorityCheckIntervalMs);
    });
    let pendingAuthorityCheck = nextAuthorityCheck();
    try {
      while (!terminal) {
        const outcome = await Promise.race([
          pendingAuthorityCheck,
          pendingEvent.then((event) => ({ type: "EVENT" as const, event })),
        ]);
        if (outcome.type === "CHECK") {
          pendingAuthorityCheck = nextAuthorityCheck();
          const state = await this.controlPlane.reconnect([{ jobId, leaseId }], [{ runId, sequence: sequence - 1 }]);
          if (state.leases[0]?.status !== "CURRENT") { await handle.interrupt(); return "AUTHORITY_LOST"; }
          await this.controlPlane.renew(jobId, leaseId, this.policy.leaseDurationMs);
          continue;
        }
        if (outcome.event.done) break;
        const event = outcome.event.value;
        pendingEvent = iterator.next();
        await this.controlPlane.appendEvent(leaseId, {
          schemaVersion: "1.0", runId, sequence: sequence++, eventType: `CODEX_${event.type}`,
          timestamp: new Date().toISOString(), correlationId: envelope.correlationId,
          payload: { type: event.type },
        });
        if (event.type === "COMPLETED" || event.type === "FAILED" || event.type === "APPROVAL_REQUIRED") terminal = event;
      }
      const completed = terminal?.type === "COMPLETED";
      const summary = terminal?.type === "COMPLETED"
        ? terminal.summary
        : "Codex execution stopped without an accepted completion.";
      await this.controlPlane.submitResult(jobId, leaseId, {
        schemaVersion: "1.0", runId, status: completed ? "COMPLETED" : "FAILED",
        completedAt: new Date().toISOString(),
        summary,
        ...(completed ? {} : { error: { code: terminal?.type === "APPROVAL_REQUIRED" ? "APPROVAL_REQUIRED" : "CODEX_RUNTIME_FAILED", message: "The bounded runtime did not complete.", retryable: true, correlationId: envelope.correlationId } }),
      });
      return completed ? "COMPLETED" : "FAILED";
    } finally {
      if (authorityTimer) clearTimeout(authorityTimer);
      await handle.shutdown();
    }
  }
}
