import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
import { handleAuthenticatedWorkerRequest } from "@/lib/piltover/modules/workers/infrastructure/worker-http-transport";

const Body = z.object({ schemaVersion: z.literal("1.0"), jobId: z.string() }).strict();
const credentials = {
  authenticate: vi.fn(async (value: string) => {
    if (value !== "valid") throw new Error("AUTH_INVALID_CREDENTIAL");
    return { workerId: "worker-a", credentialId: "credential-a" };
  }),
};

describe("P4 authenticated HTTPS polling boundary", () => {
  it("fails closed before handler execution when disabled or unauthenticated", async () => {
    const handler = vi.fn();
    const disabled = await handleAuthenticatedWorkerRequest(
      new Request("https://control.invalid/worker", { method: "POST", body: '{}' }),
      Body, credentials, handler, { enabled: false, maxBodyBytes: 1_024 },
    );
    expect(disabled.status).toBe(404);
    expect(handler).not.toHaveBeenCalled();

    const missing = await handleAuthenticatedWorkerRequest(
      new Request("https://control.invalid/worker", { method: "POST", body: '{}' }),
      Body, credentials, handler, { enabled: true, maxBodyBytes: 1_024 },
    );
    expect(missing.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("authenticates independently, validates a strict body, and never exposes stack traces", async () => {
    const handler = vi.fn(async () => ({ accepted: true }));
    const valid = await handleAuthenticatedWorkerRequest(
      new Request("https://control.invalid/worker", {
        method: "POST", headers: { authorization: "Bearer valid" },
        body: JSON.stringify({ schemaVersion: "1.0", jobId: "job-a" }),
      }),
      Body, credentials, handler, { enabled: true, maxBodyBytes: 1_024 },
    );
    expect(valid.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(
      { workerId: "worker-a", credentialId: "credential-a" },
      { schemaVersion: "1.0", jobId: "job-a" },
    );

    const invalid = await handleAuthenticatedWorkerRequest(
      new Request("https://control.invalid/worker", {
        method: "POST", headers: { authorization: "Bearer valid" },
        body: JSON.stringify({ schemaVersion: "1.0", jobId: "job-a", method: "turn/start" }),
      }),
      Body, credentials, handler, { enabled: true, maxBodyBytes: 1_024 },
    );
    expect(invalid.status).toBe(400);
    expect(await invalid.text()).not.toContain("stack");
  });

  it("rejects oversized bodies without parsing them", async () => {
    const response = await handleAuthenticatedWorkerRequest(
      new Request("https://control.invalid/worker", {
        method: "POST", headers: { authorization: "Bearer valid" }, body: "x".repeat(33),
      }),
      Body, credentials, vi.fn(), { enabled: true, maxBodyBytes: 32 },
    );
    expect(response.status).toBe(413);
  });
});
