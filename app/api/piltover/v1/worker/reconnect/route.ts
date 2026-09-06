import { WorkerReconnectRequestSchema } from "@/lib/piltover/shared/contracts/worker-bridge";
import { handleAuthenticatedWorkerRequest } from "@/lib/piltover/modules/workers/infrastructure/worker-http-transport";
import { controlPlane, credentials, workerHttpPolicy } from "../_shared";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handleAuthenticatedWorkerRequest(request, WorkerReconnectRequestSchema, credentials,
    (principal, body) => controlPlane.reconnect(principal, body.capabilityVersion, body.leases, body.acknowledgements), workerHttpPolicy);
}
