// Anthropic Messages API. Free-text `call` uses raw fetch (zero-dep, Electron-friendly);
// `callStructured` uses the Vercel AI SDK generateObject for schema-enforced output.
// Server-only: reads ANTHROPIC_API_KEY from process.env. Never import from a client.

import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import type { AIAdapter } from "./adapter";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// Capability guard: these models REJECT the `temperature` param with HTTP 400.
// Omit temperature entirely for them. NOT a default-model choice.
const NO_TEMPERATURE = /(?:opus-4-(?:7|8)|fable-5)/;

// `key` is the resolved DB-stored key (decrypted upstream); falls back to env.
export function createAnthropicAdapter(model: string, key?: string): AIAdapter {
  return {
    async call(req) {
      const apiKey = key ?? process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error(
          "Thiếu ANTHROPIC_API_KEY — đặt biến môi trường trước khi gọi AI.",
        );
      }

      const body: Record<string, unknown> = {
        model,
        max_tokens: req.maxTokens ?? 2048,
        system: req.system,
        messages: [{ role: "user", content: req.user }],
      };
      if (req.temperature !== undefined && !NO_TEMPERATURE.test(model)) {
        body.temperature = req.temperature;
      }

      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Anthropic API ${res.status}: ${detail}`);
      }

      const json = (await res.json()) as {
        content?: { text?: string }[];
        usage?: { input_tokens?: number; output_tokens?: number };
      };

      return {
        text: json.content?.[0]?.text ?? "",
        tokensIn: json.usage?.input_tokens,
        tokensOut: json.usage?.output_tokens,
      };
    },

    async callStructured(req) {
      const apiKey = key ?? process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error(
          "Thiếu ANTHROPIC_API_KEY — đặt biến môi trường trước khi gọi AI.",
        );
      }
      const anthropic = createAnthropic({ apiKey });
      const result = await generateObject({
        model: anthropic(model),
        schema: req.schema,
        system: req.system,
        prompt: req.user,
        maxOutputTokens: req.maxTokens,
        // Same capability guard as `call`: opus-4-7/4-8 & fable-5 reject temperature.
        ...(req.temperature !== undefined && !NO_TEMPERATURE.test(model)
          ? { temperature: req.temperature }
          : {}),
      });
      return {
        object: result.object,
        tokensIn: result.usage?.inputTokens,
        tokensOut: result.usage?.outputTokens,
      };
    },
  };
}
