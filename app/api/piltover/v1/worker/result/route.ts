import { RunResultSchema } from "@/lib/piltover/shared/contracts/control-plane";
import { WorkerResultSubmitSchema } from "@/lib/piltover/shared/contracts/worker-bridge";
import { handleAuthenticatedWorkerRequest } from "@/lib/piltover/modules/workers/infrastructure/worker-http-transport";
import { controlPlane, credentials, workerHttpPolicy } from "../_shared";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handleAuthenticatedWorkerRequest(request, WorkerResultSubmitSchema, credentials,
    (principal, body) => controlPlane.complete(principal, body.jobId, body.leaseId, RunResultSchema.parse(body.result)), workerHttpPolicy);
}
