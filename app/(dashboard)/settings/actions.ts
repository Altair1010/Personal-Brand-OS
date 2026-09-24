"use server";

import { execFile } from "node:child_process";
import { Socket } from "node:net";
import { promisify } from "node:util";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { wipeAll } from "@/lib/import-export/backup";
import { seedCore } from "@/prisma/seedCore";

const execFileAsync = promisify(execFile);
const WORKER_FRESH_MS = 60_000;

type StatusTone = "ok" | "warn" | "offline";

export type ControlPlaneItem = {
  label: string;
  status: string;
  tone: StatusTone;
  detail: string;
};

export type WorkerDTO = {
  id: string;
  adapter: string;
  status: string;
  lastSeenAt: string | null;
  fresh: boolean;
  capabilities: string[];
  credentialExpiresAt: string | null;
  credentialState: "VALID" | "EXPIRING" | "EXPIRED" | "MISSING";
};

export type SettingsData = {
  routing: {
    policy: "AGENT_FIRST";
    openClawReady: boolean;
    oauthReady: boolean;
    workers: WorkerDTO[];
    legacyApiKeyConfigs: number;
  };
  controlPlane: {
    infrastructure: ControlPlaneItem[];
    codebase: ControlPlaneItem[];
    server: ControlPlaneItem[];
    issues: ControlPlaneItem[];
    agents: ControlPlaneItem[];
    futureSlots: string[];
  };
};

async function git(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd: process.cwd(),
      windowsHide: true,
    });
    return stdout.trim();
  } catch {
    return "";
  }
}

async function tcpReachable(host: string, port: number, timeoutMs = 500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new Socket();
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

export async function getSettingsData(): Promise<SettingsData> {
  const now = Date.now();
  const [workers, legacyApiKeyConfigs, failedRuns, retryJobs, branch, commit, status, openClawGatewayReady] =
    await Promise.all([
      db.worker.findMany({
        include: {
          capabilities: true,
          credentials: {
            where: { revokedAt: null },
            orderBy: { expiresAt: "desc" },
            take: 1,
          },
        },
        orderBy: { lastSeenAt: "desc" },
      }),
      db.aIModelConfig.count({ where: { apiKey: { not: null } } }),
      db.agentRun.count({ where: { status: "FAILED" } }),
      db.job.count({ where: { status: { in: ["RETRY_PENDING", "FAILED"] } } }),
      git(["branch", "--show-current"]),
      git(["rev-parse", "--short", "HEAD"]),
      git(["status", "--short"]),
      tcpReachable("127.0.0.1", 18789),
    ]);

  const workerDtos: WorkerDTO[] = workers.map((worker) => {
    const lastSeenAt = worker.lastSeenAt?.toISOString() ?? null;
    const credential = worker.credentials[0] ?? null;
    const credentialMs = credential?.expiresAt.getTime() ?? 0;
    const credentialState: WorkerDTO["credentialState"] = !credential
      ? "MISSING"
      : credentialMs <= now
        ? "EXPIRED"
        : credentialMs - now <= 7 * 24 * 60 * 60 * 1000
          ? "EXPIRING"
          : "VALID";
    return {
      id: worker.id,
      adapter: worker.runtimeAdapter,
      status: worker.status,
      lastSeenAt,
      fresh:
        worker.status === "ACTIVE" &&
        !!worker.lastSeenAt &&
        now - worker.lastSeenAt.getTime() < WORKER_FRESH_MS,
      capabilities: worker.capabilities.map(({ capability }) => capability).sort(),
      credentialExpiresAt: credential?.expiresAt.toISOString() ?? null,
      credentialState,
    };
  });
  const openClawReady = workerDtos.some(
    (worker) => worker.fresh && worker.capabilities.includes("agent.execute.openclaw"),
  );
  const oauthReady = workerDtos.some(
    (worker) => worker.fresh && worker.capabilities.includes("agent.execute.oauth"),
  );
  const dirtyCount = status ? status.split(/\r?\n/).filter(Boolean).length : 0;

  return {
    routing: {
      policy: "AGENT_FIRST",
      openClawReady,
      oauthReady,
      workers: workerDtos,
      legacyApiKeyConfigs,
    },
    controlPlane: {
      infrastructure: [
        {
          label: "Worker HTTP Bridge",
          status: process.env.PILTOVER_P4_WORKER_HTTPS_POLLING === "true" ? "ENABLED" : "DISABLED",
          tone: process.env.PILTOVER_P4_WORKER_HTTPS_POLLING === "true" ? "ok" : "offline",
          detail: "Authenticated worker transport for OpenClaw/OAuth execution.",
        },
        {
          label: "Database",
          status: "CONNECTED",
          tone: "ok",
          detail: "Prisma control-plane state is readable.",
        },
        {
          label: "OpenClaw Gateway",
          status: openClawGatewayReady ? "ONLINE" : "OFFLINE",
          tone: openClawGatewayReady ? "ok" : "offline",
          detail: "Local gateway probe at 127.0.0.1:18789.",
        },
      ],
      codebase: [
        {
          label: "Git branch",
          status: branch || "UNKNOWN",
          tone: branch ? "ok" : "warn",
          detail: commit ? `HEAD ${commit}` : "Git metadata unavailable.",
        },
        {
          label: "Working tree",
          status: dirtyCount === 0 ? "CLEAN" : `${dirtyCount} CHANGES`,
          tone: dirtyCount === 0 ? "ok" : "warn",
          detail: dirtyCount === 0 ? "No tracked/untracked changes." : "Local H1 work is not committed yet.",
        },
        {
          label: "AI execution boundary",
          status: "AGENT/OAUTH ONLY",
          tone: "ok",
          detail: "Active product AI routes dispatch through Agent Control Plane; direct model API-key execution is disabled.",
        },
        {
          label: "Brand DNA file intake",
          status: "MD / DOCX / PDF",
          tone: "ok",
          detail: "Markdown (.md/.markdown), Word and PDF are accepted as source material.",
        },
      ],
      server: [
        {
          label: "Piltover runtime",
          status: "ONLINE",
          tone: "ok",
          detail: `Node ${process.version}; worker transport evaluated at server startup.`,
        },
        {
          label: "Execution policy",
          status: "AGENT FIRST",
          tone: "ok",
          detail: "OpenClaw preferred; OAuth worker is fallback. Model API-key execution is disabled in product routes.",
        },
      ],
      issues: [
        {
          label: "Failed agent runs",
          status: String(failedRuns),
          tone: failedRuns === 0 ? "ok" : "warn",
          detail: "Terminal AgentRun failures in the local control plane.",
        },
        {
          label: "Retry/failed jobs",
          status: String(retryJobs),
          tone: retryJobs === 0 ? "ok" : "warn",
          detail: "Jobs requiring retry or already exhausted.",
        },
        {
          label: "Legacy API-key configs",
          status: String(legacyApiKeyConfigs),
          tone: legacyApiKeyConfigs === 0 ? "ok" : "warn",
          detail: "Historical DB records only; active product AI routes no longer consume them.",
        },
      ],
      agents: workerDtos.map((worker) => ({
        label: worker.id,
        status: worker.fresh ? "ONLINE" : worker.status,
        tone: worker.fresh && worker.credentialState === "VALID" ? "ok" : worker.credentialState === "EXPIRING" ? "warn" : "offline",
        detail: [
          worker.adapter,
          worker.capabilities.join(", ") || "no capabilities",
          `credential ${worker.credentialState.toLowerCase()}${worker.credentialExpiresAt ? ` until ${worker.credentialExpiresAt}` : ""}`,
        ].join(" · "),
      })),
      futureSlots: [
        "Deployment / release health",
        "Repository & migration health",
        "External connector health",
        "Observability / incident status",
      ],
    },
  };
}

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function resetDatabase(confirmText: string): Promise<ActionResult> {
  if (confirmText !== "RESET") {
    return { ok: false, error: "Xác nhận không đúng. Nhập chính xác RESET." };
  }
  try {
    await db.$transaction(async (tx) => {
      await wipeAll(tx);
      await seedCore(tx, "khang-guru");
    });
    revalidatePath("/settings");
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Reset dữ liệu thất bại.",
    };
  }
}
