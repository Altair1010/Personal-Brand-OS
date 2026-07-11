/**
 * Facebook Graph API — chỉ dùng Page Access Token dán tay (không OAuth, không app review).
 * Mapping + fallback: xem research/graph-api-mapping.md.
 * Bảo mật: token đi server-side, KHÔNG log, KHÔNG trả về client. Version đặt 1 chỗ.
 */

export const GRAPH_VERSION = "v23.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

/** fetch injectable để test (mặc định global fetch của Node ≥20). */
type FetchLike = (url: string) => Promise<{ json(): Promise<unknown> }>;

export class FacebookGraphError extends Error {
  constructor(
    message: string,
    readonly kind: "token" | "request" = "request",
    readonly code?: number,
  ) {
    super(message);
    this.name = "FacebookGraphError";
  }
}

export type PostInsights = {
  reach: number | null;
  engagement: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  raw: unknown;
};

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Ném lỗi typed từ payload `error` của Graph (190 = token hết hạn/thu hồi). */
function throwOnGraphError(json: unknown): void {
  const err = (json as { error?: { code?: number; message?: string } })?.error;
  if (!err) return;
  if (err.code === 190) {
    throw new FacebookGraphError(
      "Token Facebook hết hạn hoặc bị thu hồi — vào Kết nối Facebook để cập nhật token mới.",
      "token",
      190,
    );
  }
  throw new FacebookGraphError(err.message ?? "Lỗi Facebook Graph API.", "request", err.code);
}

/**
 * Parse URL post FB → id dạng `{pageId}_{postId}` mà Graph API nhận.
 * Chấp nhận: `.../{pageId}/posts/{postId}`, `permalink.php?story_fbid=X&id=Y`,
 * hoặc chuỗi đã đúng dạng `{pageId}_{postId}`. `pfbid...` không resolve được → lỗi typed.
 */
export function resolvePostId(input: string): string {
  const s = input.trim();
  if (!s) throw new FacebookGraphError("Chưa nhập link/id bài viết.", "request");

  // Đã đúng dạng {pageId}_{postId}.
  if (/^\d+_\d+$/.test(s)) return s;

  // permalink.php?story_fbid={postId}&id={pageId}
  const story = s.match(/story_fbid=(\d+)/);
  const pageParam = s.match(/[?&]id=(\d+)/);
  if (story && pageParam) return `${pageParam[1]}_${story[1]}`;

  // .../{pageId}/posts/{postId}  (pageId phải là số)
  const posts = s.match(/\/(\d+)\/posts\/(\d+)/);
  if (posts) return `${posts[1]}_${posts[2]}`;

  throw new FacebookGraphError(
    "Không đọc được id từ link. Dán link dạng /{pageId}/posts/{id} hoặc nhập metric tay.",
    "request",
  );
}

/** Xác minh Page Access Token + lấy tên trang. Dùng khi kết nối (P2). */
export async function verifyPageToken(
  pageId: string,
  pageToken: string,
  fetchImpl: FetchLike = fetch,
): Promise<{ pageName: string }> {
  const url = `${GRAPH_BASE}/${encodeURIComponent(pageId)}?fields=name&access_token=${encodeURIComponent(pageToken)}`;
  const json = (await (await fetchImpl(url)).json()) as { name?: string };
  throwOnGraphError(json);
  if (!json.name) {
    throw new FacebookGraphError("Không lấy được tên trang — kiểm tra lại pageId/token.", "request");
  }
  return { pageName: json.name };
}

/** 1 call gộp (field expansion) → map 4 field manual + shares. Field thiếu = null. */
export async function fetchPostInsights(
  pageToken: string,
  postId: string,
  fetchImpl: FetchLike = fetch,
): Promise<PostInsights> {
  const fields =
    "insights.metric(post_impressions_unique,post_engaged_users,post_activity_by_action_type),comments.summary(true),shares,reactions.summary(true)";
  const url = `${GRAPH_BASE}/${encodeURIComponent(postId)}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(pageToken)}`;
  const json = (await (await fetchImpl(url)).json()) as Record<string, unknown>;
  throwOnGraphError(json);

  const insights = ((json.insights as { data?: { name: string; values?: { value: unknown }[] }[] })?.data) ?? [];
  const insightVal = (name: string): unknown =>
    insights.find((d) => d.name === name)?.values?.[0]?.value;

  const reach = num(insightVal("post_impressions_unique"));
  const comments = num((json.comments as { summary?: { total_count?: unknown } })?.summary?.total_count);
  const shares = num((json.shares as { count?: unknown })?.count) ?? 0;

  let engagement = num(insightVal("post_engaged_users"));
  if (engagement === null) {
    const reactions = num((json.reactions as { summary?: { total_count?: unknown } })?.summary?.total_count);
    if (reactions !== null) engagement = reactions + (comments ?? 0) + (shares ?? 0);
  }

  // saves: post_activity_by_action_type.value.save — thường vắng cho post → null (fallback tay).
  const activity = insightVal("post_activity_by_action_type");
  const saves = num((activity as { save?: unknown })?.save);

  return { reach, engagement, comments, shares, saves, raw: json };
}
