export const AGENT_RUN_STATUSES = [
  "QUEUED",
  "WAITING_FOR_WORKER",
  "CLAIMED",
  "RUNNING",
  "WAITING_APPROVAL",
  "RETRY_PENDING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

export type AgentRunStatus = (typeof AGENT_RUN_STATUSES)[number];

export const JOB_STATUSES = [
  "QUEUED",
  "CLAIMED",
  "RUNNING",
  "RETRY_PENDING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const APPROVAL_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
] as const;

export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

const AGENT_RUN_TRANSITIONS: Readonly<Record<AgentRunStatus, readonly AgentRunStatus[]>> = {
  QUEUED: ["WAITING_FOR_WORKER", "FAILED", "CANCELLED"],
  WAITING_FOR_WORKER: ["CLAIMED", "FAILED", "CANCELLED"],
  CLAIMED: ["RUNNING", "RETRY_PENDING", "FAILED", "CANCELLED"],
  RUNNING: ["WAITING_APPROVAL", "RETRY_PENDING", "COMPLETED", "FAILED", "CANCELLED"],
  WAITING_APPROVAL: ["RETRY_PENDING", "FAILED", "CANCELLED"],
  RETRY_PENDING: ["WAITING_FOR_WORKER", "FAILED", "CANCELLED"],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

const JOB_TRANSITIONS: Readonly<Record<JobStatus, readonly JobStatus[]>> = {
  QUEUED: ["CLAIMED", "FAILED", "CANCELLED"],
  CLAIMED: ["RUNNING", "RETRY_PENDING", "FAILED", "CANCELLED"],
  RUNNING: ["RETRY_PENDING", "COMPLETED", "FAILED", "CANCELLED"],
  RETRY_PENDING: ["QUEUED", "FAILED", "CANCELLED"],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

const APPROVAL_TRANSITIONS: Readonly<Record<ApprovalStatus, readonly ApprovalStatus[]>> = {
  PENDING: ["APPROVED", "REJECTED", "EXPIRED", "CANCELLED"],
  APPROVED: [],
  REJECTED: [],
  EXPIRED: [],
  CANCELLED: [],
};

function assertTransition<T extends string>(
  transitions: Readonly<Record<T, readonly T[]>>,
  from: T,
  to: T,
  errorCode: string,
): void {
  if (!transitions[from].includes(to)) throw new Error(errorCode);
}

export function assertAgentRunTransition(from: AgentRunStatus, to: AgentRunStatus): void {
  assertTransition(AGENT_RUN_TRANSITIONS, from, to, "AGENT_INVALID_TRANSITION");
}

export function assertJobTransition(from: JobStatus, to: JobStatus): void {
  assertTransition(JOB_TRANSITIONS, from, to, "QUEUE_INVALID_TRANSITION");
}

export function assertApprovalTransition(from: ApprovalStatus, to: ApprovalStatus): void {
  assertTransition(APPROVAL_TRANSITIONS, from, to, "APPROVAL_INVALID_TRANSITION");
}
