// OpenAI Chat Completions via raw fetch (no SDK). Server-only: reads OPENAI_API_KEY.
// OpenAI accepts temperature, so no capability guard is needed here.

import type { AIAdapter } from "./adapter";

const ENDPOINT = "https://api.openai.com/v1/chat/completions";

export function createOpenAIAdapter(model: string): AIAdapter {
  return {
    async call(req) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error(
          "Thiếu OPENAI_API_KEY — đặt biến môi trường trước khi gọi AI.",
        );
      }

      const body: Record<string, unknown> = {
        model,
        max_tokens: req.maxTokens ?? 2048,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
      };
      if (req.temperature !== undefined) {
        body.temperature = req.temperature;
      }

      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`OpenAI API ${res.status}: ${detail}`);
      }

      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      return {
        text: json.choices?.[0]?.message?.content ?? "",
        tokensIn: json.usage?.prompt_tokens,
        tokensOut: json.usage?.completion_tokens,
      };
    },
  };
}
