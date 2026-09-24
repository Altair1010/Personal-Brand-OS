export type EvalCase<TInput = unknown, TOutput = unknown> = {
  id: string;
  input: TInput;
  expected?: unknown;
  tags?: string[];
  evaluate: (output: TOutput) => { passed: boolean; score: number; reasons: string[] };
};

export async function runEvalSuite<TInput, TOutput>(input: {
  cases: EvalCase<TInput, TOutput>[];
  runner: (value: TInput) => Promise<TOutput>;
}) {
  const results = [];
  for (const testCase of input.cases) {
    try {
      const output = await input.runner(testCase.input);
      const verdict = testCase.evaluate(output);
      results.push({ id: testCase.id, ok: verdict.passed, score: verdict.score, reasons: verdict.reasons });
    } catch (error) {
      results.push({
        id: testCase.id,
        ok: false,
        score: 0,
        reasons: [error instanceof Error ? error.message : "RUN_FAILED"],
      });
    }
  }
  const score = results.length
    ? results.reduce((sum, row) => sum + row.score, 0) / results.length
    : 0;
  return {
    score,
    passed: results.length > 0 && results.every((row) => row.ok),
    results,
  };
}

export function compareEvalRuns(
  baseline: { score: number },
  candidate: { score: number },
  tolerance = 0,
) {
  const delta = candidate.score - baseline.score;
  return {
    delta,
    regressed: delta < -Math.abs(tolerance),
    improved: delta > Math.abs(tolerance),
  };
}
