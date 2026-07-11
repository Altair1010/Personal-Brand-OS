import { describe, it, expect } from "vitest";
import {
  resolvePostId,
  fetchPostInsights,
  verifyPageToken,
  FacebookGraphError,
} from "@/lib/facebook/graph";

const mockFetch = (json: unknown) => async () => ({ json: async () => json });

describe("resolvePostId", () => {
  it("chuỗi đã đúng dạng {pageId}_{postId}", () => {
    expect(resolvePostId("111_222")).toBe("111_222");
  });
  it("permalink.php?story_fbid=X&id=Y", () => {
    expect(
      resolvePostId("https://www.facebook.com/permalink.php?story_fbid=222&id=111"),
    ).toBe("111_222");
  });
  it("/{pageId}/posts/{postId}", () => {
    expect(resolvePostId("https://www.facebook.com/111/posts/222")).toBe("111_222");
  });
  it("pfbid / link không đọc được → lỗi typed", () => {
    expect(() => resolvePostId("https://www.facebook.com/Page/posts/pfbid0abc")).toThrow(
      FacebookGraphError,
    );
  });
  it("rỗng → lỗi", () => {
    expect(() => resolvePostId("   ")).toThrow(FacebookGraphError);
  });
});

describe("fetchPostInsights", () => {
  it("map đủ 5 field từ payload đầy đủ", async () => {
    const payload = {
      insights: {
        data: [
          { name: "post_impressions_unique", values: [{ value: 1500 }] },
          { name: "post_engaged_users", values: [{ value: 240 }] },
          { name: "post_activity_by_action_type", values: [{ value: { save: 12 } }] },
        ],
      },
      comments: { summary: { total_count: 8 } },
      shares: { count: 5 },
      reactions: { summary: { total_count: 100 } },
    };
    const r = await fetchPostInsights("tok", "111_222", mockFetch(payload));
    expect(r).toMatchObject({ reach: 1500, engagement: 240, comments: 8, shares: 5, saves: 12 });
    expect(r.raw).toBe(payload);
  });

  it("field thiếu → null (saves vắng, shares mặc định 0)", async () => {
    const payload = {
      insights: { data: [{ name: "post_impressions_unique", values: [{ value: 300 }] }] },
      comments: { summary: { total_count: 2 } },
      reactions: { summary: { total_count: 40 } },
    };
    const r = await fetchPostInsights("tok", "111_222", mockFetch(payload));
    expect(r.reach).toBe(300);
    expect(r.saves).toBeNull();
    expect(r.shares).toBe(0);
    // engagement fallback = reactions + comments + shares = 40 + 2 + 0
    expect(r.engagement).toBe(42);
  });

  it("token hết hạn (code 190) → FacebookGraphError kind=token", async () => {
    const payload = { error: { code: 190, message: "expired" } };
    await expect(fetchPostInsights("tok", "x", mockFetch(payload))).rejects.toMatchObject({
      kind: "token",
      code: 190,
    });
  });
});

describe("verifyPageToken", () => {
  it("trả pageName khi token hợp lệ", async () => {
    const r = await verifyPageToken("111", "tok", mockFetch({ name: "Khang Guru" }));
    expect(r.pageName).toBe("Khang Guru");
  });
  it("token sai → lỗi", async () => {
    await expect(
      verifyPageToken("111", "bad", mockFetch({ error: { code: 190, message: "bad" } })),
    ).rejects.toThrow(FacebookGraphError);
  });
});
