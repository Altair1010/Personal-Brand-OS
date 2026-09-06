import { RunEventSchema } from "@/lib/piltover/shared/contracts/control-plane";
import { WorkerEventAppendSchema } from "@/lib/piltover/shared/contracts/worker-bridge";
import { handleAuthenticatedWorkerRequest } from "@/lib/piltover/modules/workers/infrastructure/worker-http-transport";
import { controlPlane, credentials, workerHttpPolicy } from "../_shared";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handleAuthenticatedWorkerRequest(request, WorkerEventAppendSchema, credentials,
    (principal, body) => controlPlane.appendEvent(principal, body.leaseId, RunEventSchema.parse(body.event)), workerHttpPolicy);
}
