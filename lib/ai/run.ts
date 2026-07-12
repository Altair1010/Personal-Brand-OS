// P0.3 pipeline — the ONE call path for every AI module:
// validateInput → (sanitizeExternal handled in buildUser input) → call(low temp) →
// safeJsonParse → outputSchema.safeParse → repairOnce → normalizeInCode → savePromptRun.
// Never throws for adapter/parse failures — always resolves a discriminated result.

import type { ZodType } from "zod";
import { db } from "@/lib/db";
import { GLOBAL_CONTRACT, buildRepairPrompt } from "./contract";
import { safeJsonParse } from "./json";
import {
  getAdapter,
  resolveModelConfig,
  type AIAdapter,
} from "./adapter";

export interface PromptModule<I, O> {
  key: string;
  role?: string;
  system: string;
  buildUser: (input: I) => string;
  inputSchema: ZodType<I>;
  outputSchema: ZodType<O>;
  temperature: number;
  selfCheck?: string;
  normalize?: (o: O) => O;
}

export type RunResult<O> =
  | { ok: true; data: O; status: string }
  | { ok: false; error: string; status: string };

const MAX_TOKENS = 2048;

export async function runModule<I, O>(
  module: PromptModule<I, O>,
  input: unknown,
  opts?: { adapter?: AIAdapter },
): Promise<RunResult<O>> {
  // 1. validateInput
  const parsed = module.inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: summarizeZod(parsed.error),
      status: "error",
    };
  }

  const system = `${GLOBAL_CONTRACT}\n\n${module.system}`;
  const userPrompt = module.buildUser(parsed.data);

  let provider = "unknown";
  let model = "unknown";
  let adapter: AIAdapter;
  try {
    if (opts?.adapter) {
      adapter = opts.adapter;
    } else {
      const cfg = await resolveModelConfig();
      provider = cfg.provider;
      model = cfg.model;
      adapter = getAdapter(cfg);
    }
  } catch (e) {
    // Model/config resolution failure — surface loudly, no run persisted.
    return { ok: false, error: errMsg(e), status: "error" };
  }

  // Preferred path: schema-constrained output via the AI SDK (generateObject). Used by the
  // real provider adapters; injected mock adapters (tests) omit callStructured → text path.
  if (adapter.callStructured) {
    const started = Date.now();
    try {
      const res = await adapter.callStructured({
        system,
        user: userPrompt,
        schema: module.outputSchema,
        temperature: module.temperature,
        maxTokens: MAX_TOKENS,
      });
      // Re-validate defensively: generateObject validates in prod, but an injected mock
      // adapter returns its object verbatim — safeParse keeps the enum/shape contract for
      // every caller regardless of adapter source.
      const checked = module.outputSchema.safeParse(res.object);
      if (!checked.success) {
        const errorSummary = summarizeZod(checked.error);
        await savePromptRun({
          module,
          provider,
          model,
          input,
          rawOutput: JSON.stringify(res.object),
          parsedOutput: null,
          status: "invalid_json",
          latencyMs: Date.now() - started,
          tokensIn: res.tokensIn,
          tokensOut: res.tokensOut,
          error: errorSummary,
        });
        return { ok: false, error: errorSummary, status: "invalid_json" };
      }
      const data = module.normalize
        ? module.normalize(checked.data)
        : checked.data;
      await savePromptRun({
        module,
        provider,
        model,
        input,
        rawOutput: JSON.stringify(res.object),
        parsedOutput: data,
        status: "ok",
        latencyMs: Date.now() - started,
        tokensIn: res.tokensIn,
        tokensOut: res.tokensOut,
        error: null,
      });
      return { ok: true, data, status: "ok" };
    } catch (e) {
      // generateObject throws when it cannot produce a schema-valid object.
      await savePromptRun({
        module,
        provider,
        model,
        input,
        rawOutput: "",
        parsedOutput: null,
        status: "invalid_json",
        latencyMs: Date.now() - started,
        error: errMsg(e),
      });
      return { ok: false, error: errMsg(e), status: "invalid_json" };
    }
  }

  let rawOutput = "";
  let tokensIn: number | undefined;
  let tokensOut: number | undefined;
  const started = Date.now();

  try {
    // 2. call (low temp for structured output)
    const first = await adapter.call({
      system,
      user: userPrompt,
      temperature: module.temperature,
      maxTokens: MAX_TOKENS,
    });
    rawOutput = first.text;
    tokensIn = first.tokensIn;
    tokensOut = first.tokensOut;

    // 3. parse + validate
    let validated = validate(module, rawOutput);

    // 4. repairOnce — exactly one retry on validation failure
    if (!validated.ok) {
      const repairUser = `${userPrompt}\n\n${buildRepairPrompt(
        validated.errorSummary,
        schemaHintFor(module),
      )}`;
      const second = await adapter.call({
        system,
        user: repairUser,
        temperature: module.temperature,
        maxTokens: MAX_TOKENS,
      });
      rawOutput = second.text;
      if (second.tokensIn !== undefined) tokensIn = second.tokensIn;
      if (second.tokensOut !== undefined) tokensOut = second.tokensOut;
      validated = validate(module, rawOutput);
    }

    const latencyMs = Date.now() - started;

    if (!validated.ok) {
      await savePromptRun({
        module,
        provider,
        model,
        input,
        rawOutput,
        parsedOutput: null,
        status: "invalid_json",
        latencyMs,
        tokensIn,
        tokensOut,
        error: validated.errorSummary,
      });
      return {
        ok: false,
        error: validated.errorSummary,
        status: "invalid_json",
      };
    }

    // 5. normalizeInCode
    const data = module.normalize
      ? module.normalize(validated.value)
      : validated.value;

    await savePromptRun({
      module,
      provider,
      model,
      input,
      rawOutput,
      parsedOutput: data,
      status: "ok",
      latencyMs,
      tokensIn,
      tokensOut,
      error: null,
    });

    return { ok: true, data, status: "ok" };
  } catch (e) {
    const latencyMs = Date.now() - started;
    await savePromptRun({
      module,
      provider,
      model,
      input,
      rawOutput,
      parsedOutput: null,
      status: "error",
      latencyMs,
      tokensIn,
      tokensOut,
      error: errMsg(e),
    });
    return { ok: false, error: errMsg(e), status: "error" };
  }
}

function validate<I, O>(
  module: PromptModule<I, O>,
  raw: string,
):
  | { ok: true; value: O }
  | { ok: false; errorSummary: string } {
  const parsed = safeJsonParse(raw);
  if (!parsed.ok) {
    return { ok: false, errorSummary: "Không parse được JSON từ output." };
  }
  const result = module.outputSchema.safeParse(parsed.value);
  if (!result.success) {
    return { ok: false, errorSummary: summarizeZod(result.error) };
  }
  return { ok: true, value: result.data };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function summarizeZod(error: any): string {
  const issues = error?.issues ?? [];
  return (
    issues
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((i: any) => `${(i.path ?? []).join(".") || "(root)"}: ${i.message}`)
      .join("; ") || "Lỗi validate không xác định."
  );
}

function schemaHintFor<I, O>(module: PromptModule<I, O>): string {
  // A terse key hint; we avoid dumping full JSON schema to save tokens.
  return `moduleKey="${module.key}". ${module.selfCheck ?? ""}`.trim();
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// savePromptRun — persist every run for eval/debug. Wrapped so a DB failure never
// breaks the pipeline result (also keeps tests hermetic without a live DB).
async function savePromptRun<I, O>(args: {
  module: PromptModule<I, O>;
  provider: string;
  model: string;
  input: unknown;
  rawOutput: string;
  parsedOutput: unknown;
  status: string;
  latencyMs: number;
  tokensIn?: number;
  tokensOut?: number;
  error: string | null;
}): Promise<void> {
  try {
    const template = await db.promptTemplate.findFirst({
      where: { moduleKey: args.module.key, isActive: true },
    });
    await db.promptRun.create({
      data: {
        promptTemplateId: template?.id ?? null,
        moduleKey: args.module.key,
        provider: args.provider,
        model: args.model,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        input: args.input as any,
        rawOutput: args.rawOutput,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parsedOutput: (args.parsedOutput ?? null) as any,
        status: args.status,
        latencyMs: args.latencyMs,
        tokensIn: args.tokensIn ?? null,
        tokensOut: args.tokensOut ?? null,
        error: args.error,
      },
    });
  } catch {
    // Persistence is best-effort; swallow so the pipeline result is unaffected.
  }
}
