import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import type { BoundedCodexExecution, CodexExecutionHandle, CodexRuntimeEvent, CodexRuntimePort } from "../../../shared/ports/worker-bridge-ports";

interface PendingRequest { resolve(value: unknown): void; reject(error: Error): void }

class EventStream implements AsyncIterable<CodexRuntimeEvent> {
  private values: CodexRuntimeEvent[] = [];
  private waiting: ((value: IteratorResult<CodexRuntimeEvent>) => void)[] = [];
  private ended = false;
  push(value: CodexRuntimeEvent): void { const waiter = this.waiting.shift(); waiter ? waiter({ value, done: false }) : this.values.push(value); }
  close(): void { this.ended = true; for (const waiter of this.waiting.splice(0)) waiter({ value: undefined, done: true }); }
  [Symbol.asyncIterator](): AsyncIterator<CodexRuntimeEvent> {
    return { next: async () => {
      const value = this.values.shift();
      if (value) return { value, done: false };
      if (this.ended) return { value: undefined, done: true };
      return new Promise((resolve) => this.waiting.push(resolve));
    } };
  }
}

export interface CodexAppServerConfig {
  readonly codexModulePath: string;
  readonly startupTimeoutMs?: number;
  readonly shutdownTimeoutMs?: number;
  readonly maxFrameBytes?: number;
  readonly executionTimeoutMs?: number;
  readonly protocolTrace?: (direction: "request" | "response" | "notification" | "server-request", name: string) => void;
}

function instruction(task: unknown): string {
  if (!task || typeof task !== "object" || Array.isArray(task) || !("instruction" in task) ||
      typeof task.instruction !== "string" || task.instruction.length < 1 || task.instruction.length > 20_000) {
    throw new Error("CODEX_TASK_INVALID");
  }
  return task.instruction;
}

function codexEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(environment)) {
    if (key.startsWith("PILTOVER_WORKER_CREDENTIAL") || key.startsWith("PILTOVER_MACHINE_CREDENTIAL")) {
      delete environment[key];
    }
  }
  return environment;
}

export class CodexAppServerAdapter implements CodexRuntimePort {
  constructor(private readonly config: CodexAppServerConfig) {}

  async start(execution: BoundedCodexExecution): Promise<CodexExecutionHandle> {
    const prompt = instruction(execution.task);
    const child = spawn(process.execPath, [this.config.codexModulePath, "app-server", "--listen", "stdio://"], {
      cwd: execution.repositoryPath, stdio: ["pipe", "pipe", "pipe"], windowsHide: true, shell: false,
      env: codexEnvironment(),
    });
    try {
      return await this.initialize(child, execution, prompt);
    } catch (error) {
      child.kill();
      throw error;
    }
  }

  private async initialize(child: ChildProcessWithoutNullStreams, execution: BoundedCodexExecution, prompt: string): Promise<CodexExecutionHandle> {
    const events = new EventStream();
    const pending = new Map<number, PendingRequest>();
    let nextId = 1;
    let threadId = "";
    let turnId = "";
    let frameFailure: Error | null = null;
    let executionTimer: ReturnType<typeof setTimeout> | undefined;
    const write = (value: unknown) => child.stdin.write(`${JSON.stringify(value)}\n`);
    const request = (method: string, params: unknown): Promise<unknown> => {
      const id = nextId++;
      this.config.protocolTrace?.("request", method);
      write({ jsonrpc: "2.0", id, method, params });
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    };
    const lines = createInterface({ input: child.stdout });
    lines.on("line", (line) => {
      if (Buffer.byteLength(line, "utf8") > (this.config.maxFrameBytes ?? 1024 * 1024)) {
        frameFailure = new Error("CODEX_PROTOCOL_FRAME_TOO_LARGE"); child.kill(); return;
      }
      let message: Record<string, unknown>;
      try { message = JSON.parse(line) as Record<string, unknown>; } catch { frameFailure = new Error("CODEX_PROTOCOL_INVALID_JSON"); child.kill(); return; }
      if (typeof message.id === "number" && !message.method) {
        this.config.protocolTrace?.("response", String(message.id));
        const waiter = pending.get(message.id); pending.delete(message.id);
        if (waiter) message.error ? waiter.reject(new Error("CODEX_PROTOCOL_REQUEST_FAILED")) : waiter.resolve(message.result);
        return;
      }
      if (typeof message.method !== "string") return;
      if ("id" in message) {
        this.config.protocolTrace?.("server-request", message.method);
        events.push({ type: "APPROVAL_REQUIRED", kind: message.method });
        frameFailure = new Error("CODEX_APPROVAL_REQUIRED"); child.kill(); return;
      }
      const params = (message.params ?? {}) as Record<string, unknown>;
      this.config.protocolTrace?.("notification", message.method);
      if (message.method === "item/agentMessage/delta" && typeof params.delta === "string") {
        events.push({ type: "MESSAGE_DELTA", text: params.delta });
      }
      if (message.method === "turn/completed") {
        if (executionTimer) clearTimeout(executionTimer);
        const turn = params.turn as Record<string, unknown> | undefined;
        if (turn?.status === "completed") events.push({ type: "COMPLETED", summary: "Codex execution completed." });
        else events.push({ type: "FAILED", message: "Codex execution did not complete successfully." });
        events.close();
      }
    });
    child.once("exit", (code) => {
      if (executionTimer) clearTimeout(executionTimer);
      for (const waiter of pending.values()) waiter.reject(frameFailure ?? new Error(`CODEX_PROCESS_EXITED:${code ?? "unknown"}`));
      pending.clear();
      if (frameFailure) events.push({ type: "FAILED", message: frameFailure.message });
      events.close();
    });

    const startupTimeoutMs = this.config.startupTimeoutMs ?? 15_000;
    const withTimeout = async <T>(promise: Promise<T>): Promise<T> => Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error("CODEX_STARTUP_TIMEOUT")), startupTimeoutMs)),
    ]);
    await withTimeout(request("initialize", { clientInfo: { name: "piltover-personal-worker", version: "1.0.0" } }));
    write({ jsonrpc: "2.0", method: "initialized", params: {} });
    const thread = await withTimeout(request("thread/start", {
      cwd: execution.repositoryPath, approvalPolicy: "never", sandbox: "workspace-write", ephemeral: true,
    })) as { thread?: { id?: string } };
    threadId = thread.thread?.id ?? "";
    if (!threadId) throw new Error("CODEX_THREAD_START_INVALID");
    const turn = await withTimeout(request("turn/start", { threadId, input: [{ type: "text", text: prompt }] })) as { turn?: { id?: string } };
    turnId = turn.turn?.id ?? "";
    if (!turnId) throw new Error("CODEX_TURN_START_INVALID");
    events.push({ type: "EXECUTION_STARTED", threadId, turnId });
    executionTimer = setTimeout(() => {
      frameFailure = new Error("CODEX_EXECUTION_TIMEOUT");
      events.push({ type: "FAILED", message: frameFailure.message });
      events.close();
      child.kill();
    }, this.config.executionTimeoutMs ?? 180_000);

    return {
      events,
      interrupt: async () => { if (threadId && turnId) await request("turn/interrupt", { threadId, turnId }); },
      shutdown: async () => {
        if (child.exitCode !== null) return;
        child.kill();
        await Promise.race([
          new Promise<void>((resolve) => child.once("exit", () => resolve())),
          new Promise<void>((resolve) => setTimeout(resolve, this.config.shutdownTimeoutMs ?? 5_000)),
        ]);
      },
    };
  }
}
