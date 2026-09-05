import { describe, expect, it } from "vitest";
import {
  ApprovalSchema,
  RunEventSchema,
  RunRequestSchema,
  RunResultSchema,
  WorkerRegistrationSchema,
} from "@/lib/piltover/shared/contracts/control-plane";

const runRequest = {
  schemaVersion: "1.0",
  runId: "run-1",
  organizationId: "org-1",
  workspaceId: null,
  brandId: null,
  roleRef: "role:writer@1",
  task: { type: "WRITE", instruction: "Draft a post", boundedOption: true },
  contextRef: { id: "context-1", hash: "sha256:context" },
  permissionManifestRef: "permission:1",
  requiredCapabilities: ["git"],
  idempotencyKey: null,
  priority: 50,
} as const;

const runEvent = {
  schemaVersion: "1.0",
  runId: "run-1",
  sequence: 0,
  eventType: "RUN_QUEUED",
  timestamp: "2026-09-06T00:00:00.000Z",
  correlationId: "correlation-1",
  payload: { safe: true },
  workerId: null,
} as const;

const runResult = {
  schemaVersion: "1.0",
  runId: "run-1",
  status: "COMPLETED",
  completedAt: "2026-09-06T00:01:00.000Z",
  summary: "Completed safely",
  artifacts: [{ kind: "document", ref: "artifact:1", hash: null }],
  error: null,
} as const;

const worker = {
  schemaVersion: "1.0",
  workerId: "worker-1",
  deviceName: "Owner workstation",
  os: null,
  capabilities: ["filesystem:scoped", "git"],
  runtime: { adapter: "future-runtime", version: "1.0.0", protocolVersion: null },
  repoMappings: { piltover: "repo:piltover" },
} as const;

const approval = {
  schemaVersion: "1.0",
  approvalId: "approval-1",
  actionType: "PUBLISH",
  targetRef: "brand:1",
  payloadHash: "sha256:payload",
  status: "PENDING",
  requestedBy: "identity-1",
  decidedBy: null,
  expiresAt: "2026-09-07T00:00:00.000Z",
  oneTimeNonce: null,
} as const;

describe.each([
  ["RunRequest", RunRequestSchema, runRequest, "runId"],
  ["RunEvent", RunEventSchema, runEvent, "sequence"],
  ["RunResult", RunResultSchema, runResult, "summary"],
  ["WorkerRegistration", WorkerRegistrationSchema, worker, "deviceName"],
  ["Approval", ApprovalSchema, approval, "payloadHash"],
] as const)("%s schema", (_name, schema, valid, requiredKey) => {
  it("accepts the canonical 1.0 shape", () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it("rejects a missing required field", () => {
    const candidate = { ...valid } as Record<string, unknown>;
    delete candidate[requiredKey];
    expect(schema.safeParse(candidate).success).toBe(false);
  });

  it("rejects the wrong schema version and unknown top-level properties", () => {
    expect(schema.safeParse({ ...valid, schemaVersion: "2.0" }).success).toBe(false);
    expect(schema.safeParse({ ...valid, unexpected: true }).success).toBe(false);
  });
});

describe("canonical nullable fields", () => {
  it("accepts explicit null only where the package schema allows it", () => {
    expect(RunRequestSchema.parse(runRequest).workspaceId).toBeNull();
    expect(WorkerRegistrationSchema.parse(worker).os).toBeNull();
    expect(ApprovalSchema.parse(approval).decidedBy).toBeNull();
  });

  it("rejects invalid nested extension and duplicate capabilities", () => {
    expect(
      RunRequestSchema.safeParse({
        ...runRequest,
        contextRef: { ...runRequest.contextRef, unexpected: true },
      }).success,
    ).toBe(false);
    expect(
      WorkerRegistrationSchema.safeParse({ ...worker, capabilities: ["git", "git"] }).success,
    ).toBe(false);
  });
});
