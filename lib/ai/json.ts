// Robust JSON extraction — models sometimes wrap output in ```json fences or add a
// leading/trailing sentence despite the contract. Strip fences, slice the outermost
// object, then JSON.parse. Never throws.

export function safeJsonParse(
  raw: string,
): { ok: true; value: unknown } | { ok: false } {
  if (!raw) return { ok: false };

  // Strip ```json ... ``` or ``` ... ``` fences.
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return { ok: false };

  const candidate = text.slice(first, last + 1);
  try {
    return { ok: true, value: JSON.parse(candidate) };
  } catch {
    return { ok: false };
  }
}
