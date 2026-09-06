import { z } from "zod";

const RepositoryAliasSchema = z.string().regex(/^[a-z0-9](?:[a-z0-9._-]{0,62})$/);

export const WorkerExecutionEnvelopeSchema = z.object({
  schemaVersion: z.literal("1.0"),
  runId: z.string().min(1),
  jobId: z.string().min(1),
  leaseId: z.string().min(1),
  correlationId: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  brandId: z.string().min(1).nullable(),
  task: z.unknown(),
  roleRef: z.string().min(1),
  contextRef: z.unknown(),
  permissionManifestRef: z.string().min(1),
  requiredCapabilities: z.array(z.string().min(1)),
  repositoryAlias: RepositoryAliasSchema,
}).strict();

export type WorkerExecutionEnvelope = z.infer<typeof WorkerExecutionEnvelopeSchema>;

export const WorkerPollSchema = z.object({
  schemaVersion: z.literal("1.0"),
  leaseDurationMs: z.number().int().min(1_000).max(60_000),
}).strict();

export const ExecutionEnvelopeRequestSchema = z.object({
  schemaVersion: z.literal("1.0"),
  jobId: z.string().min(1),
  leaseId: z.string().min(1),
}).strict();

export const WorkerHeartbeatSchema = z.object({ schemaVersion: z.literal("1.0") }).strict();

export const WorkerMarkRunningSchema = z.object({
  schemaVersion: z.literal("1.0"), jobId: z.string().min(1), leaseId: z.string().min(1),
}).strict();

export const WorkerLeaseRenewalSchema = WorkerMarkRunningSchema.extend({
  leaseDurationMs: z.number().int().min(1_000).max(60_000),
}).strict();

export const WorkerEventAppendSchema = z.object({
  schemaVersion: z.literal("1.0"), leaseId: z.string().min(1), event: z.unknown(),
}).strict();

export const WorkerResultSubmitSchema = z.object({
  schemaVersion: z.literal("1.0"), jobId: z.string().min(1), leaseId: z.string().min(1), result: z.unknown(),
}).strict();

export const WorkerReconnectRequestSchema = z.object({
  schemaVersion: z.literal("1.0"),
  capabilityVersion: z.number().int().nonnegative(),
  leases: z.array(z.object({ jobId: z.string().min(1), leaseId: z.string().min(1) }).strict()),
  acknowledgements: z.array(z.object({ runId: z.string().min(1), sequence: z.number().int().min(-1) }).strict()),
}).strict();

export const WorkerCredentialFormat = /^([A-Za-z0-9_-]{8,128})\.([A-Za-z0-9_-]{43})$/;
