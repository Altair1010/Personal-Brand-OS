// Ratio normalization — the project NEVER trusts an LLM to make percentages sum to 100.
// Every AI-produced ratio (pillar ratioPercent, objectiveMix) is re-normalized here in code.
// Deterministic integer output whose sum is EXACTLY 100 (largest-remainder rounding).

/**
 * Scale a list of non-negative weights to integer percentages summing to exactly 100.
 * - All-zero (or empty) input → distributes 100 as evenly as possible.
 * - Uses largest-remainder: floor everything, then hand the leftover units to the
 *   entries with the biggest fractional parts. Guarantees sum === 100, no negatives.
 */
export function normalizeWeightsTo100(weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];

  const clean = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const total = clean.reduce((a, b) => a + b, 0);

  // Degenerate input (all zero) → spread 100 evenly, remainder to the first slots.
  if (total <= 0) {
    const base = Math.floor(100 / n);
    const out = new Array<number>(n).fill(base);
    for (let i = 0; i < 100 - base * n; i++) out[i] += 1;
    return out;
  }

  const exact = clean.map((w) => (w / total) * 100);
  const floors = exact.map((x) => Math.floor(x));
  let remaining = 100 - floors.reduce((a, b) => a + b, 0);

  // Hand out the leftover units to the largest fractional parts (ties: lower index).
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);

  const out = [...floors];
  for (let k = 0; remaining > 0; k = (k + 1) % n, remaining--) {
    out[order[k].i] += 1;
  }
  return out;
}

/**
 * Normalize the `key` field across a list of objects so those values sum to exactly 100.
 * Returns new objects (does not mutate). Reused by pillar ratioPercent and objectiveMix.
 */
export function normalizeRatioTo100<T, K extends keyof T>(
  items: T[],
  key: K,
): T[] {
  const weights = items.map((it) => Number(it[key]) || 0);
  const normalized = normalizeWeightsTo100(weights);
  return items.map((it, i) => ({ ...it, [key]: normalized[i] }));
}

/**
 * Normalize a record of numeric values (e.g. objectiveMix {seo, educate, ...}) to sum 100.
 * Key order is preserved.
 */
export function normalizeRecordTo100<K extends string>(
  record: Record<K, number>,
): Record<K, number> {
  const keys = Object.keys(record) as K[];
  const normalized = normalizeWeightsTo100(keys.map((k) => Number(record[k]) || 0));
  const out = {} as Record<K, number>;
  keys.forEach((k, i) => {
    out[k] = normalized[i];
  });
  return out;
}
