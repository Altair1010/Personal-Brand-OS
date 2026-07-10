const DAY_MS = 86_400_000;

/**
 * Số ngày kể từ khi post được xuất bản (fallback createdAt) tới `now`.
 * Thuần, không I/O — dùng cho MetricSnapshot.daysSincePost.
 */
export function computeDaysSincePost(
  post: { publishedAt: Date | null; createdAt: Date },
  now?: Date,
): number {
  const ref = post.publishedAt ?? post.createdAt;
  return Math.max(
    0,
    Math.floor(((now ?? new Date()).getTime() - ref.getTime()) / DAY_MS),
  );
}
