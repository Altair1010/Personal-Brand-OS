import { WorkerHeartbeatSchema } from "@/lib/piltover/shared/contracts/worker-bridge";
import { handleAuthenticatedWorkerRequest } from "@/lib/piltover/modules/workers/infrastructure/worker-http-transport";
import { controlPlane, credentials, workerHttpPolicy } from "../_shared";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handleAuthenticatedWorkerRequest(request, WorkerHeartbeatSchema, credentials,
    (principal) => controlPlane.heartbeat(principal), workerHttpPolicy);
}
