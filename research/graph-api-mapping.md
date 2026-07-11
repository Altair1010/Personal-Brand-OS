# EM1c — Facebook Graph API mapping (P0 research)

> Nguồn: context7 `/websites/developers_facebook_graph-api` (Insights, field-expansion, reactions/comments summary). Scope: chỉ **Page Access Token dán tay** cho page user là admin — KHÔNG OAuth, KHÔNG app review.

## API version
- Dùng `v23.0` (ổn định). **Cảnh báo:** `post_impressions_unique` + `post_*_unique` bị deprecate từ **v26.0** → nếu Graph trả lỗi metric, coi `reach = null` (fallback nhập tay). Đặt version 1 chỗ (`GRAPH_VERSION` const trong `lib/facebook/graph.ts`).

## Xác minh token khi kết nối (P2)
```
GET https://graph.facebook.com/v23.0/{pageId}?fields=name&access_token={pageToken}
```
- 200 + `{ name }` → token hợp lệ, lưu `pageName`.
- Lỗi (190 token / 100 param) → báo user "token/pageId sai", KHÔNG tạo row.

## resolvePostId(url) — parse URL post → `{pageId}_{postId}`
Chấp nhận các dạng:
| URL | postId |
|-----|--------|
| `.../{pageId}/posts/{postId}` | `{pageId}_{postId}` |
| `permalink.php?story_fbid={postId}&id={pageId}` | `{pageId}_{postId}` |
| Chuỗi đã có dạng `{pageId}_{postId}` (dán trực tiếp) | dùng nguyên |
- `pfbid...` (token mờ) KHÔNG resolve được sang id số → throw lỗi typed "dán link dạng /posts/{id} hoặc id số"; user nhập tay như fallback.

## fetchPostInsights — 1 call gộp (field expansion)
```
GET https://graph.facebook.com/v23.0/{postId}
  ?fields=insights.metric(post_impressions_unique,post_engaged_users,post_activity_by_action_type),comments.summary(true),shares,reactions.summary(true)
  &access_token={pageToken}
```

### Map → 4 field manual (reach/engagement/comments/saves) + shares phụ
| Field app | Đường lấy trong JSON | Thiếu → |
|-----------|----------------------|---------|
| `reach` | `insights.data[name=post_impressions_unique].values[0].value` | `null` |
| `engagement` | `insights.data[name=post_engaged_users].values[0].value` | fallback `reactions.summary.total_count + comments + shares`; vẫn thiếu → `null` |
| `comments` | `comments.summary.total_count` | `null` |
| `shares` | `shares.count` (field `shares` vắng khi =0) | `0` |
| `saves` | `insights.data[name=post_activity_by_action_type].values[0].value.save` | **thường vắng cho post** → `null` (fallback nhập tay) |

- Lưu **toàn bộ JSON** vào `MetricSnapshot.fbRawResponse` (audit + tương lai).
- Field không lấy được = `null` (schema `Int?` cho phép) → user điền tay bổ sung.

## Lỗi & hết hạn token
- Graph trả `error.code=190` (`OAuthException`, token hết hạn/thu hồi) → throw lỗi typed `FacebookTokenError` "Token Facebook hết hạn — vào Kết nối Facebook cập nhật token mới". **KHÔNG** tự OAuth refresh.
- `error.code=100` (metric/field sai) → coi field đó `null`, không fail toàn bộ nếu các field khác OK.

## Ghi chú bảo mật
- Token chỉ đi server-side (action), mã hoá bằng `lib/ai/keystore.ts encryptString` trước khi lưu.
- KHÔNG log token. KHÔNG trả token về client. Strip khỏi cloud backup (`STRIP_FIELDS.FacebookAccount=["accessToken"]`).
