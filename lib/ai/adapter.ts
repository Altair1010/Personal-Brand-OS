// Provider-agnostic AI adapter boundary. run.ts depends only on this interface, never on
// a concrete provider. Model + provider resolve from the default AIModelConfig row with
// env fallback — never hardcode a model string (RULES #3).

import { db } from "@/lib/db";
import { createAnthropicAdapter } from "./anthropic";
import { createOpenAIAdapter } from "./openai";
import { decryptString } from "./keystore";

export interface AIAdapter {
  call(req: {
    system: string;
    user: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<{ text: string; tokensIn?: number; tokensOut?: number }>;
}

export async function resolveModelConfig(): Promise<{
  provider: string;
  model: string;
  apiKey?: string;
}> {
  const row =
    (await db.aIModelConfig.findFirst({ where: { isDefault: true } })) ??
    (await db.aIModelConfig.findFirst());

  const provider =
    row?.provider || process.env.AI_DEFAULT_PROVIDER || "anthropic";
  const model = row?.model || process.env.AI_DEFAULT_MODEL || "";

  if (!model) {
    throw new Error(
      "Chưa chọn model AI — đặt AI_DEFAULT_MODEL trong .env hoặc chọn trong Settings (M10).",
    );
  }

  // Decrypt the stored key if present; env fallback happens inside the adapter.
  const apiKey = row?.apiKey ? decryptString(row.apiKey) : undefined;

  return { provider, model, apiKey };
}

export function getAdapter(cfg: {
  provider: string;
  model: string;
  apiKey?: string;
}): AIAdapter {
  switch (cfg.provider) {
    case "anthropic":
      return createAnthropicAdapter(cfg.model, cfg.apiKey);
    case "openai":
      return createOpenAIAdapter(cfg.model, cfg.apiKey);
    default:
      throw new Error(`Provider AI không hỗ trợ: ${cfg.provider}`);
  }
}
