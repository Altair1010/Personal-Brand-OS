// Model presets — the SINGLE source of selectable models. The call path (adapter/run)
// NEVER hardcodes a model string; it resolves the model from AIModelConfig, and this list
// only powers the Settings picker + validation (RULES #3: presets are DATA, not code).
// Users may still enter a custom model string; presets are convenience, not a whitelist.

export type ModelProvider = "anthropic" | "openai";
export type ModelLevel = "Low" | "Medium" | "High" | "Extra";

export interface ModelPreset {
  provider: ModelProvider;
  model: string;
  label: string;
  level: ModelLevel;
}

export const MODEL_PRESETS: readonly ModelPreset[] = [
  // Anthropic (Claude)
  { provider: "anthropic", model: "claude-haiku-4-5", label: "Claude Haiku 4.5", level: "Low" },
  { provider: "anthropic", model: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", level: "High" },
  { provider: "anthropic", model: "claude-opus-4-8", label: "Claude Opus 4.8", level: "Extra" },
  // OpenAI (GPT)
  { provider: "openai", model: "gpt-4o-mini", label: "GPT-4o mini", level: "Low" },
  { provider: "openai", model: "gpt-4o", label: "GPT-4o", level: "Medium" },
  { provider: "openai", model: "gpt-4.1", label: "GPT-4.1", level: "High" },
] as const;

// Look up a preset by its model id. Returns undefined for custom/unknown models.
export function findPreset(model: string): ModelPreset | undefined {
  return MODEL_PRESETS.find((p) => p.model === model);
}

// True when the model id matches a known preset (used to distinguish preset vs custom).
export function isPresetModel(model: string): boolean {
  return findPreset(model) !== undefined;
}
