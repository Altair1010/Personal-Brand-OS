import type { WorkerExecutionEnvelope } from "../../../shared/contracts/worker-bridge";
import type { WorkerControlPlaneClientPort } from "../../../shared/ports/worker-bridge-ports";

export interface HttpsWorkerClientConfig {
  readonly baseUrl: string;
  readonly credential: string;
  readonly capabilityVersion: number;
  readonly requestTimeoutMs?: number;
  readonly fetch?: typeof fetch;
}

export class HttpsWorkerControlPlaneClient implements WorkerControlPlaneClientPort {
  private readonly baseUrl: URL;
  private readonly fetcher: typeof fetch;

  constructor(private readonly config: HttpsWorkerClientConfig) {
    this.baseUrl = new URL(config.baseUrl);
    if (this.baseUrl.protocol !== "https:" && !["localhost", "127.0.0.1", "::1"].includes(this.baseUrl.hostname)) {
      throw new Error("WORKER_TRANSPORT_TLS_REQUIRED");
    }
    this.fetcher = config.fetch ?? fetch;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs ?? 30_000);
    try {
      const response = await this.fetcher(new URL(path, this.baseUrl), {
        method: "POST",
        headers: { authorization: `Bearer ${this.config.credential}`, "content-type": "application/json" },
        body: JSON.stringify(body), signal: controller.signal,
      });
      const decoded = await response.json() as T & { code?: string };
      if (!response.ok) throw new Error(decoded.code ?? `WORKER_TRANSPORT_HTTP_${response.status}`);
      return decoded;
    } finally { clearTimeout(timeout); }
  }

  async heartbeat(): Promise<void> { await this.post("/api/piltover/v1/worker/heartbeat", { schemaVersion: "1.0" }); }
  poll(leaseDurationMs: number) { return this.post<{ claim: { job: { id: string; runId: string }; lease: { id: string } } | null }>("/api/piltover/v1/worker/poll", { schemaVersion: "1.0", leaseDurationMs }); }
  getExecutionEnvelope(jobId: string, leaseId: string) { return this.post<WorkerExecutionEnvelope>("/api/piltover/v1/worker/execution-envelope", { schemaVersion: "1.0", jobId, leaseId }); }
  async markRunning(jobId: string, leaseId: string): Promise<void> { await this.post("/api/piltover/v1/worker/running", { schemaVersion: "1.0", jobId, leaseId }); }
  async renew(jobId: string, leaseId: string, leaseDurationMs: number): Promise<void> { await this.post("/api/piltover/v1/worker/renew", { schemaVersion: "1.0", jobId, leaseId, leaseDurationMs }); }
  async appendEvent(leaseId: string, event: unknown): Promise<void> { await this.post("/api/piltover/v1/worker/event", { schemaVersion: "1.0", leaseId, event }); }
  async submitResult(jobId: string, leaseId: string, result: unknown): Promise<void> { await this.post("/api/piltover/v1/worker/result", { schemaVersion: "1.0", jobId, leaseId, result }); }
  reconnect(leases: readonly { jobId: string; leaseId: string }[], acknowledgements: readonly { runId: string; sequence: number }[]) {
    return this.post<{ leases: readonly { jobId: string; leaseId: string; status: string }[] }>("/api/piltover/v1/worker/reconnect", {
      schemaVersion: "1.0", capabilityVersion: this.config.capabilityVersion, leases, acknowledgements,
    });
  }
}
