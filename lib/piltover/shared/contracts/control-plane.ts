import { z } from "zod";

const schemaVersion = z.literal("1.0");
const nonEmptyString = z.string().trim().min(1);
const dateTime = z.iso.datetime({ offset: true });

export const ErrorEnvelopeSchema = z
  .object({
    code: z.string().regex(/^[A-Z]+_[A-Z0-9_]+$/),
    message: nonEmptyString,
    retryable: z.boolean(),
    correlationId: nonEmptyString,
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const RunRequestSchema = z
  .object({
    schemaVersion,
    runId: nonEmptyString,
    organizationId: nonEmptyString,
    workspaceId: nonEmptyString.nullable().optional(),
    brandId: nonEmptyString.nullable().optional(),
    roleRef: nonEmptyString,
    task: z
      .object({ type: nonEmptyString, instruction: nonEmptyString })
      .passthrough(),
    contextRef: z.object({ id: nonEmptyString, hash: nonEmptyString }).strict(),
    permissionManifestRef: nonEmptyString,
    requiredCapabilities: z.array(nonEmptyString).optional(),
    idempotencyKey: nonEmptyString.nullable().optional(),
    priority: z.number().int().min(0).max(100).optional(),
  })
  .strict();

export const RunEventSchema = z
  .object({
    schemaVersion,
    runId: nonEmptyString,
    sequence: z.number().int().min(0),
    eventType: nonEmptyString,
    timestamp: dateTime,
    correlationId: nonEmptyString,
    payload: z.record(z.string(), z.unknown()).optional(),
    workerId: nonEmptyString.nullable().optional(),
  })
  .strict();

export const RunResultSchema = z
  .object({
    schemaVersion,
    runId: nonEmptyString,
    status: z.enum(["COMPLETED", "FAILED", "CANCELLED"]),
    completedAt: dateTime,
    summary: z.string(),
    artifacts: z
      .array(
        z
          .object({
            kind: nonEmptyString,
            ref: nonEmptyString,
            hash: nonEmptyString.nullable().optional(),
          })
          .strict(),
      )
      .optional(),
    error: ErrorEnvelopeSchema.nullable().optional(),
  })
  .strict();

export const WorkerRegistrationSchema = z
  .object({
    schemaVersion,
    workerId: nonEmptyString,
    deviceName: nonEmptyString,
    os: nonEmptyString.nullable().optional(),
    capabilities: z.array(nonEmptyString).refine((items) => new Set(items).size === items.length, {
      message: "Capabilities must be unique.",
    }),
    runtime: z
      .object({
        adapter: nonEmptyString,
        version: nonEmptyString,
        protocolVersion: nonEmptyString.nullable().optional(),
      })
      .strict(),
    repoMappings: z.record(z.string(), nonEmptyString).optional(),
  })
  .strict();

export const ApprovalSchema = z
  .object({
    schemaVersion,
    approvalId: nonEmptyString,
    actionType: nonEmptyString,
    targetRef: nonEmptyString,
    payloadHash: nonEmptyString,
    status: z.enum(["PENDING", "APPROVED", "REJECTED", "EXPIRED", "CANCELLED"]),
    requestedBy: nonEmptyString,
    decidedBy: nonEmptyString.nullable().optional(),
    expiresAt: dateTime,
    oneTimeNonce: nonEmptyString.nullable().optional(),
  })
  .strict();

export type RunRequest = z.infer<typeof RunRequestSchema>;
export type RunEvent = z.infer<typeof RunEventSchema>;
export type RunResult = z.infer<typeof RunResultSchema>;
export type WorkerRegistration = z.infer<typeof WorkerRegistrationSchema>;
export type Approval = z.infer<typeof ApprovalSchema>;
