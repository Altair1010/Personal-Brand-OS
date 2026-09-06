import { defineFeatureFlag, resolveFeatureFlag } from "./feature-flags";

export const P4_FEATURE_FLAGS = [defineFeatureFlag({
  key: "p4.workerHttpsPolling",
  owner: "P4 Personal Worker",
  purpose: "Expose the authenticated versioned Worker polling transport after the P4 security gate.",
  default: false,
  removalCondition: "Remove when the P4 transport is canonical and permanently governed by deployment configuration.",
})] as const;

export function isWorkerHttpsPollingEnabled(environment: NodeJS.ProcessEnv = process.env): boolean {
  const raw = environment.PILTOVER_P4_WORKER_HTTPS_POLLING;
  const override = raw === undefined ? undefined : raw === "true" ? true : raw === "false" ? false : undefined;
  if (raw !== undefined && override === undefined) throw new Error("VALIDATION_FEATURE_FLAG_INVALID");
  return resolveFeatureFlag("p4.workerHttpsPolling", P4_FEATURE_FLAGS,
    override === undefined ? {} : { "p4.workerHttpsPolling": override });
}
