import { db } from "@/lib/db";
import { PrismaJobQueue } from "@/lib/piltover/modules/agents/infrastructure/prisma-job-queue";
import { PrismaRunEvents } from "@/lib/piltover/modules/agents/infrastructure/prisma-run-events";
import { PrismaWorkerReconnect } from "@/lib/piltover/modules/agents/infrastructure/prisma-worker-reconnect";
import { PrismaExecutionEnvelope } from "@/lib/piltover/modules/agents/infrastructure/prisma-execution-envelope";
import { AuthenticatedWorkerControlPlane } from "@/lib/piltover/modules/workers/application/authenticated-worker-control-plane";
import { PrismaWorkerCredentialStore } from "@/lib/piltover/modules/workers/infrastructure/prisma-worker-credentials";
import { PrismaWorkerRegistry } from "@/lib/piltover/modules/workers/infrastructure/prisma-worker-registry";
import { isWorkerHttpsPollingEnabled } from "@/lib/piltover/shared/architecture/p4-feature-flags";

const registry = new PrismaWorkerRegistry(db);
export const credentials = new PrismaWorkerCredentialStore(db);
export const controlPlane = new AuthenticatedWorkerControlPlane(
  new PrismaJobQueue(db), registry, new PrismaRunEvents(db), new PrismaWorkerReconnect(db), new PrismaExecutionEnvelope(db),
);
export const workerHttpPolicy = { enabled: isWorkerHttpsPollingEnabled(), maxBodyBytes: 16 * 1_024 } as const;
