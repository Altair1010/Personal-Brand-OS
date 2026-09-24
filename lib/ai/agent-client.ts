export async function invokeAgentAi<T>(
  endpoint: string,
  input: unknown,
  options: { timeoutMs?: number; pollMs?: number } = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 120 * 60_000;
  const pollMs = options.pollMs ?? 1_000;
  const start = Date.now();

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error ?? "Agent request failed.");
  }

  if (!json.data?.queued) {
    return json.data as T;
  }

  const runId = String(json.data.runId);
  while (Date.now() - start < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, pollMs));
    const statusRes = await fetch(`/api/ai/runs/${encodeURIComponent(runId)}`, {
      cache: "no-store",
    });
    const statusJson = await statusRes.json();
    if (statusRes.status === 202 || statusJson.pending) continue;
    if (!statusRes.ok || !statusJson.ok) {
      throw new Error(statusJson.error ?? "Agent run failed.");
    }
    return statusJson.data as T;
  }

  throw new Error(
    "Agent chưa hoàn tất trong giới hạn 120 phút. Run vẫn được lưu trong Control Plane; bạn có thể kiểm tra trạng thái hoặc dừng thủ công trong Agent Chat.",
  );
}
