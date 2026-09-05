export const CORE_PORT_NAMES = [
  "AuthPort",
  "UserDirectoryPort",
  "OrganizationRepository",
  "BrandRepository",
  "ContentRepository",
  "TaskRepository",
  "MetricRepository",
  "AuditPort",
  "BlobStoragePort",
  "JobQueuePort",
  "WorkerRegistryPort",
  "ApprovalPort",
  "PublisherPort",
  "CodexRuntimePort",
  "GitHostingPort",
  "ClockPort",
  "IdGeneratorPort",
] as const;

export type CorePortName = (typeof CORE_PORT_NAMES)[number];

export interface ClockPort {
  now(): Date;
}

export interface IdGeneratorPort {
  generate(): string;
}
