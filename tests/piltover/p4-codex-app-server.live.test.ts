import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";
import { CodexAppServerAdapter } from "@/lib/piltover/modules/workers/infrastructure/codex-app-server-adapter";
import { LocalRepositoryResolver } from "@/lib/piltover/modules/workers/infrastructure/local-repository-resolver";
import { PrismaWorkerCredentialStore } from "@/lib/piltover/modules/workers/infrastructure/prisma-worker-credentials";
import { PrismaWorkerRegistry } from "@/lib/piltover/modules/workers/infrastructure/prisma-worker-registry";
import { PrismaExecutionEnvelope } from "@/lib/piltover/modules/agents/infrastructure/prisma-execution-envelope";
import { PrismaJobQueue } from "@/lib/piltover/modules/agents/infrastructure/prisma-job-queue";
import { PrismaRunEvents } from "@/lib/piltover/modules/agents/infrastructure/prisma-run-events";
import { PrismaWorkerReconnect } from "@/lib/piltover/modules/agents/infrastructure/prisma-worker-reconnect";
import { AuthenticatedWorkerControlPlane } from "@/lib/piltover/modules/workers/application/authenticated-worker-control-plane";
import { PersonalWorker } from "@/lib/piltover/modules/workers/application/personal-worker";
import { createP3Fixture } from "./p3-test-db";

const runLive = process.env.PILTOVER_RUN_LIVE_CODEX_POC === "1";
const describeLive = runLive ? describe : describe.skip;
const roots: string[] = [];

afterAll(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

describeLive("P4 real local Codex App Server POC", () => {
  it("runs an authenticated P3 lease through a real bounded App Server execution", async () => {
    const codexModulePath = process.env.PILTOVER_CODEX_MODULE_PATH;
    if (!codexModulePath) throw new Error("PILTOVER_CODEX_MODULE_PATH is required for the live POC.");
    const repositoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "piltover-p4-codex-poc-"));
    roots.push(repositoryPath);
    execFileSync("git", ["init"], { cwd: repositoryPath, stdio: "pipe" });
    const fixture = await createP3Fixture();
    const clock = { now: () => new Date() };
    const registry = new PrismaWorkerRegistry(fixture.db, clock);
    const queue = new PrismaJobQueue(fixture.db, clock);
    const credentials = new PrismaWorkerCredentialStore(fixture.db, clock);
    await registry.register({
      schemaVersion: "1.0", workerId: "worker-live", deviceName: "P4 isolated live fixture",
      capabilities: ["git"], runtime: { adapter: "codex-app-server", version: "0.153.4", protocolVersion: "1.0" },
    });
    await registry.grantWorkspace(fixture.ownerActor, "worker-live", "workspace-a", "grant-live");
    const issued = await credentials.issue(fixture.ownerActor, "worker-live", { type: "WORKSPACE", id: "workspace-a" }, 300_000, "credential-live");
    await queue.createRun({
      schemaVersion: "1.0", runId: "run-live", organizationId: "org-a", workspaceId: "workspace-a", brandId: null,
      roleRef: "role:p4-poc@1", task: {
        type: "WRITE",
        instruction: "Create a file named PILTOVER_P4_POC.txt containing exactly: Piltover P4 bounded App Server proof\nDo not modify any other file.",
        repositoryAlias: "fixture",
      }, contextRef: { id: "opaque-context", hash: "opaque-hash" }, permissionManifestRef: "permission:opaque@1",
      requiredCapabilities: ["git"], idempotencyKey: "run-live",
    }, "p4-live-poc");
    await queue.enqueue({ id: "job-live", runId: "run-live", idempotencyKey: "job-live", maxAttempts: 2 });

    const trace: string[] = [];
    const runtime = new CodexAppServerAdapter({
      codexModulePath, startupTimeoutMs: 30_000, executionTimeoutMs: 210_000,
      protocolTrace: (direction, name) => { trace.push(`${direction}:${name}`); },
    });
    const application = new AuthenticatedWorkerControlPlane(
      queue, registry, new PrismaRunEvents(fixture.db, clock), new PrismaWorkerReconnect(fixture.db, clock),
      new PrismaExecutionEnvelope(fixture.db, clock),
    );
    const principal = async () => credentials.authenticate(issued.credential);
    const client = {
      heartbeat: async () => { await application.heartbeat(await principal()); },
      poll: async (leaseDurationMs: number) => application.poll(await principal(), leaseDurationMs),
      getExecutionEnvelope: async (jobId: string, leaseId: string) => application.envelope(await principal(), jobId, leaseId),
      markRunning: async (jobId: string, leaseId: string) => { await application.markRunning(await principal(), jobId, leaseId); },
      renew: async (jobId: string, leaseId: string, leaseDurationMs: number) => { await application.renew(await principal(), jobId, leaseId, leaseDurationMs); },
      appendEvent: async (leaseId: string, event: unknown) => { await application.appendEvent(await principal(), leaseId, event as never); },
      submitResult: async (jobId: string, leaseId: string, result: unknown) => { await application.complete(await principal(), jobId, leaseId, result as never); },
      reconnect: async (leases: readonly { jobId: string; leaseId: string }[], acknowledgements: readonly { runId: string; sequence: number }[]) =>
        application.reconnect(await principal(), 1, leases, acknowledgements),
    };
    try {
      const worker = new PersonalWorker(client, new LocalRepositoryResolver(repositoryPath, { fixture: repositoryPath }), runtime,
        { leaseDurationMs: 30_000, authorityCheckIntervalMs: 10_000 });
      await expect(worker.executeOnce()).resolves.toBe("COMPLETED");
      expect(trace).toContain("request:initialize");
      expect(trace).toContain("request:thread/start");
      expect(trace).toContain("request:turn/start");
      expect((await fixture.db.agentRun.findUniqueOrThrow({ where: { id: "run-live" } })).status).toBe("COMPLETED");
      expect(await fixture.db.runEvent.count({ where: { runId: "run-live" } })).toBeGreaterThan(1);
      expect(fs.readFileSync(path.join(repositoryPath, "PILTOVER_P4_POC.txt"), "utf8").trim())
        .toBe("Piltover P4 bounded App Server proof");
      expect(execFileSync("git", ["status", "--short"], { cwd: repositoryPath, encoding: "utf8" }).trim())
        .toBe("?? PILTOVER_P4_POC.txt");
    } finally {
      await fixture.database.dispose();
    }
  }, 240_000);
});
