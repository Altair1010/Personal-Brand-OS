import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const cwd = process.cwd();
const isWindows = process.platform === "win32";
const node = process.execPath;
const nextCli = path.join(cwd, "node_modules", "next", "dist", "bin", "next");
const tsxCli = path.join(cwd, "node_modules", "tsx", "dist", "cli.mjs");
const baseUrl = process.env.PILTOVER_WORKER_URL || "http://127.0.0.1:3000";
const restartBaseMs = 2_000;
const restartMaxMs = 30_000;

let shuttingDown = false;
let web = null;
let worker = null;
let workerRestartTimer = null;
let workerFailures = 0;
let publishingWorker = null;
let publishingRestartTimer = null;
let publishingFailures = 0;

function log(message) {
  process.stdout.write(`[supervisor] ${message}\n`);
}

function killTree(child) {
  if (!child?.pid) return;
  try {
    if (isWindows) {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
    } else {
      child.kill("SIGTERM");
    }
  } catch {}
}

function spawnWeb() {
  log("starting Next.js dev server...");
  web = spawn(node, [nextCli, "dev"], {
    cwd,
    stdio: "inherit",
    env: process.env,
    windowsHide: false,
  });
  web.once("exit", (code, signal) => {
    log(`web exited code=${code ?? "null"} signal=${signal ?? "null"}`);
    if (!shuttingDown) {
      shuttingDown = true;
      if (workerRestartTimer) clearTimeout(workerRestartTimer);
      if (publishingRestartTimer) clearTimeout(publishingRestartTimer);
      killTree(worker);
      killTree(publishingWorker);
      process.exitCode = code ?? 1;
    }
  });
}

async function waitForWeb() {
  const deadline = Date.now() + 90_000;
  while (!shuttingDown && Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl, { redirect: "manual" });
      if (response.status > 0) {
        log(`web ready at ${baseUrl}`);
        return true;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return false;
}

function scheduleWorkerRestart() {
  if (shuttingDown || workerRestartTimer) return;
  const delay = Math.min(restartMaxMs, restartBaseMs * 2 ** Math.min(workerFailures, 4));
  log(`worker restart scheduled in ${delay}ms`);
  workerRestartTimer = setTimeout(() => {
    workerRestartTimer = null;
    startWorker();
  }, delay);
}

function startWorker() {
  if (shuttingDown) return;
  log(`starting OpenClaw worker -> ${baseUrl}`);
  worker = spawn(node, [tsxCli, "scripts/piltover-openclaw-worker.ts"], {
    cwd,
    stdio: "inherit",
    env: { ...process.env, PILTOVER_WORKER_URL: baseUrl },
    windowsHide: false,
  });
  const startedAt = Date.now();
  worker.once("exit", (code, signal) => {
    const lifetime = Date.now() - startedAt;
    log(`worker exited code=${code ?? "null"} signal=${signal ?? "null"} after ${lifetime}ms`);
    worker = null;
    if (shuttingDown) return;
    workerFailures = lifetime > 60_000 ? 0 : workerFailures + 1;
    scheduleWorkerRestart();
  });
}


function schedulePublishingRestart() {
  if (shuttingDown || publishingRestartTimer) return;
  const delay = Math.min(restartMaxMs, restartBaseMs * 2 ** Math.min(publishingFailures, 4));
  log(`publishing worker restart scheduled in ${delay}ms`);
  publishingRestartTimer = setTimeout(() => {
    publishingRestartTimer = null;
    startPublishingWorker();
  }, delay);
}

function startPublishingWorker() {
  if (shuttingDown) return;
  log("starting publishing scheduler worker...");
  publishingWorker = spawn(node, [tsxCli, "scripts/piltover-publishing-worker.ts"], {
    cwd,
    stdio: "inherit",
    env: process.env,
    windowsHide: false,
  });
  const startedAt = Date.now();
  publishingWorker.once("exit", (code, signal) => {
    const lifetime = Date.now() - startedAt;
    log(`publishing worker exited code=${code ?? "null"} signal=${signal ?? "null"} after ${lifetime}ms`);
    publishingWorker = null;
    if (shuttingDown) return;
    publishingFailures = lifetime > 60_000 ? 0 : publishingFailures + 1;
    schedulePublishingRestart();
  });
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`shutdown requested by ${signal}`);
  if (workerRestartTimer) clearTimeout(workerRestartTimer);
  if (publishingRestartTimer) clearTimeout(publishingRestartTimer);
  killTree(worker);
  killTree(publishingWorker);
  killTree(web);
  setTimeout(() => process.exit(0), 250).unref();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

spawnWeb();
const ready = await waitForWeb();
if (!ready) {
  log("web server did not become ready within 90s");
  await shutdown("WEB_START_TIMEOUT");
} else {
  startWorker();
  startPublishingWorker();
}
