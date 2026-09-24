import { db } from "../lib/db";
import { runAuthorizedPublishingSchedulerCycle } from "../lib/piltover/vnext/publishing-scheduler";

const workerId = process.env.PILTOVER_PUBLISHING_WORKER_ID || `publishing-worker:${process.pid}`;
const pollMs = Math.max(1_000, Number(process.env.PILTOVER_PUBLISHING_POLL_MS || 5_000));
const leaseMs = Math.max(5_000, Number(process.env.PILTOVER_PUBLISHING_LEASE_MS || 60_000));
let stopping = false;

async function cycle() {
  const results = await runAuthorizedPublishingSchedulerCycle(db, { workerId, limit: 10, leaseMs });
  if (results.length) console.log(JSON.stringify({ event: "publishing-cycle", workerId, results }));
}

async function main() {
  console.log(JSON.stringify({ event: "publishing-worker-started", workerId, pollMs, leaseMs }));
  while (!stopping) {
    try { await cycle(); }
    catch (error) { console.error(JSON.stringify({ event: "publishing-worker-error", error: error instanceof Error ? error.message : String(error) })); }
    if (!stopping) await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  await db.$disconnect();
}

process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });
void main();
