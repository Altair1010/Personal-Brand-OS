import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpsWorkerControlPlaneClient } from "@/lib/piltover/modules/workers/infrastructure/https-worker-control-plane-client";
import { LocalRepositoryResolver } from "@/lib/piltover/modules/workers/infrastructure/local-repository-resolver";
import { PersonalWorker } from "@/lib/piltover/modules/workers/application/personal-worker";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

describe("P4 outbound Personal Worker", () => {
  it("uses only fixed versioned HTTPS operations and keeps the bearer out of the body", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetcher = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      calls.push({ url: String(input), init: init ?? {} });
      return new Response(JSON.stringify({ claim: null }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    const client = new HttpsWorkerControlPlaneClient({
      baseUrl: "https://control.piltover.invalid", credential: "credential.secret", capabilityVersion: 1, fetch: fetcher,
    });
    await client.poll(10_000);
    expect(calls[0].url).toBe("https://control.piltover.invalid/api/piltover/v1/worker/poll");
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe("Bearer credential.secret");
    expect(calls[0].init.body).not.toContain("credential.secret");
    expect(() => new HttpsWorkerControlPlaneClient({ baseUrl: "http://remote.invalid", credential: "x", capabilityVersion: 1 }))
      .toThrow("WORKER_TRANSPORT_TLS_REQUIRED");
  });

  it("executes one claimed lease through the local allowlist and submits ordered evidence", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "piltover-p4-worker-"));
    roots.push(root);
    const repo = path.join(root, "fixture"); fs.mkdirSync(repo);
    const appended: unknown[] = [];
    const submitted: unknown[] = [];
    const controlPlane = {
      heartbeat: vi.fn(async () => {}),
      poll: vi.fn(async () => ({ claim: { job: { id: "job-a", runId: "run-a" }, lease: { id: "lease-a" } } })),
      getExecutionEnvelope: vi.fn(async () => ({
        schemaVersion: "1.0" as const, runId: "run-a", jobId: "job-a", leaseId: "lease-a",
        correlationId: "correlation-a", organizationId: "org-a", workspaceId: "workspace-a", brandId: null,
        task: { instruction: "Harmless" }, roleRef: "role:1", contextRef: {}, permissionManifestRef: "permission:1",
        requiredCapabilities: ["git"], repositoryAlias: "fixture",
      })),
      markRunning: vi.fn(async () => {}), renew: vi.fn(async () => {}), reconnect: vi.fn(),
      appendEvent: vi.fn(async (_leaseId: string, event: unknown) => { appended.push(event); }),
      submitResult: vi.fn(async (_jobId: string, _leaseId: string, result: unknown) => { submitted.push(result); }),
    };
    const runtime = { start: vi.fn(async () => ({
      events: (async function* () {
        yield { type: "EXECUTION_STARTED" as const, threadId: "thread-a", turnId: "turn-a" };
        yield { type: "MESSAGE_DELTA" as const, text: "done" };
        yield { type: "COMPLETED" as const, summary: "done" };
      })(), interrupt: vi.fn(async () => {}), shutdown: vi.fn(async () => {}),
    })) };
    const worker = new PersonalWorker(controlPlane, new LocalRepositoryResolver(root, { fixture: repo }), runtime,
      { leaseDurationMs: 30_000, authorityCheckIntervalMs: 60_000 });
    await expect(worker.executeOnce()).resolves.toBe("COMPLETED");
    expect(appended.map((event) => (event as { sequence: number }).sequence)).toEqual([0, 1, 2]);
    expect(submitted).toEqual([expect.objectContaining({ status: "COMPLETED", runId: "run-a" })]);
    expect(runtime.start).toHaveBeenCalledWith(expect.objectContaining({ repositoryPath: fs.realpathSync(repo) }));
  });

  it("interrupts the local runtime when reconnect reports lost authority", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "piltover-p4-authority-")); roots.push(root);
    const repo = path.join(root, "fixture"); fs.mkdirSync(repo);
    const interrupt = vi.fn(async () => {});
    const controlPlane = {
      heartbeat: vi.fn(async () => {}),
      poll: vi.fn(async () => ({ claim: { job: { id: "job-a", runId: "run-a" }, lease: { id: "lease-a" } } })),
      getExecutionEnvelope: vi.fn(async () => ({ schemaVersion: "1.0" as const, runId: "run-a", jobId: "job-a", leaseId: "lease-a",
        correlationId: "c", organizationId: "org-a", workspaceId: "workspace-a", brandId: null, task: { instruction: "safe" },
        roleRef: "r", contextRef: {}, permissionManifestRef: "p", requiredCapabilities: [], repositoryAlias: "fixture" })),
      markRunning: vi.fn(async () => {}), renew: vi.fn(async () => {}), appendEvent: vi.fn(async () => {}), submitResult: vi.fn(async () => {}),
      reconnect: vi.fn(async () => ({ leases: [{ jobId: "job-a", leaseId: "lease-a", status: "UNAUTHORIZED" }] })),
    };
    const runtime = { start: vi.fn(async () => ({ events: (async function* () { await new Promise((resolve) => setTimeout(resolve, 100)); })(), interrupt, shutdown: vi.fn(async () => {}) })) };
    const worker = new PersonalWorker(controlPlane, new LocalRepositoryResolver(root, { fixture: repo }), runtime,
      { leaseDurationMs: 30_000, authorityCheckIntervalMs: 1 });
    await expect(worker.executeOnce()).resolves.toBe("AUTHORITY_LOST");
    expect(interrupt).toHaveBeenCalledOnce();
    expect(controlPlane.submitResult).not.toHaveBeenCalled();
  });
});
