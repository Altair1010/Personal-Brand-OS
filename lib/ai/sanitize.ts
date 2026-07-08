// P0.1 — Injection guard. Any external text (upload/paste) is treated as DATA, not
// instructions. We strip common control phrases, truncate, and wrap in <<DATA>> markers
// so the model (via the Global Contract) ignores any commands inside.

// ~8k tokens ≈ 32000 chars (rough 4 chars/token heuristic).
const MAX_CHARS = 32000;

// Case-insensitive control phrases to neutralize before wrapping.
const CONTROL_PHRASES = [
  "ignore all previous",
  "ignore previous",
  "disregard previous",
  "system:",
  "assistant:",
];

export function stripControlPhrases(text: string): string {
  let out = text;
  for (const phrase of CONTROL_PHRASES) {
    // Escape regex specials in the literal phrase, then match case-insensitively.
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(escaped, "gi"), "[removed]");
  }
  return out;
}

export function sanitizeExternal(
  text: string,
  source: "upload" | "paste",
): string {
  const truncated = text.slice(0, MAX_CHARS);
  const cleaned = stripControlPhrases(truncated).trim();
  return `<<DATA source="${source}">>\n${cleaned}\n<<END DATA>>`;
}
