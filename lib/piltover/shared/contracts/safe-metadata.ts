const SECRET_KEY = /(password|bearer.?token|api.?key|private.?key|secret|credential|authorization)/i;

export function containsObviousSecret(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsObviousSecret);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(
    ([key, nested]) => SECRET_KEY.test(key) || containsObviousSecret(nested),
  );
}
