// M7 — approve a ContentDraft → tạo Post gắn attribution bắt buộc.
// INVARIANT: Post PHẢI có strategyVersionId + dailyPlanId, nếu thiếu → throw (Revision Engine cần).
// Single-user: userId = "local", AppState id = "singleton".

import { db } from "@/lib/db";

const USER_ID = "local";
const APP_STATE_ID = "singleton";

export interface ApproveDraftResult {
  postId: string;
  draftId: string;
}

/**
 * Approve một ContentDraft: set status="approved", tạo Post với đầy đủ attribution.
 * Idempotent-safe: nếu Post đã tồn tại cho draft → throw "draft đã được approve".
 */
export async function approveDraft(draftId: string): Promise<ApproveDraftResult> {
  return db.$transaction(async (tx) => {
    // 1. Load draft kèm contentIdea để lấy dailyPlanId.
    const draft = await tx.contentDraft.findUnique({
      where: { id: draftId },
      include: { contentIdea: { select: { dailyPlanId: true } } },
    });
    if (!draft) {
      throw new Error(`ContentDraft không tồn tại: ${draftId}`);
    }

    // Idempotent guard: Post.contentDraftId @unique — nếu đã có → reject.
    const existingPost = await tx.post.findUnique({
      where: { contentDraftId: draftId },
      select: { id: true },
    });
    if (existingPost) {
      throw new Error(
        `Draft "${draftId}" đã được approve (Post: ${existingPost.id}). Không thể approve lại.`,
      );
    }

    // 2. dailyPlanId từ contentIdea (có thể null).
    const dailyPlanId = draft.contentIdea?.dailyPlanId ?? null;

    // 3. strategyVersionId = version mới nhất của Strategy đang active.
    const appState = await tx.appState.findUnique({
      where: { id: APP_STATE_ID },
      select: { activeStrategyId: true },
    });
    const activeStrategyId = appState?.activeStrategyId ?? null;

    let strategyVersionId: string | null = null;
    if (activeStrategyId) {
      const latestVersion = await tx.strategyVersion.findFirst({
        where: { strategyId: activeStrategyId },
        orderBy: { version: "desc" },
        select: { id: true },
      });
      strategyVersionId = latestVersion?.id ?? null;
    }

    // 4. INVARIANT KHÓA: phải có cả hai attribution field.
    if (!strategyVersionId || !dailyPlanId) {
      const missing: string[] = [];
      if (!strategyVersionId) missing.push("strategyVersionId (không có active strategy hoặc chưa có version)");
      if (!dailyPlanId) missing.push("dailyPlanId (contentIdea chưa gắn với DailyPlan)");
      throw new Error(
        `Không thể approve draft — thiếu attribution bắt buộc: ${missing.join("; ")}. ` +
          "Revision Engine yêu cầu Post phải gắn đầy đủ strategyVersionId + dailyPlanId.",
      );
    }

    // 5. Ghép finalText từ hook/body/ending (plain text).
    const parts = [draft.hook, draft.body, draft.ending].filter(Boolean);
    const finalText = parts.join("\n\n") || draft.contentMarkdown || "";

    // 6. Tạo Post — mirror analytic dims từ draft.
    const post = await tx.post.create({
      data: {
        contentDraftId: draftId,
        userId: USER_ID,
        strategyVersionId,
        dailyPlanId,
        finalText,
        platform: "facebook",
        status: "posted",
        // mirror analytic dims
        objectiveKey: draft.objectiveKey,
        pillarId: draft.pillarId,
        hookStyle: draft.hookStyle,
        ctaIntensity: draft.ctaIntensity,
        format: draft.format,
        topic: draft.topic,
        publishedAt: new Date(),
      },
    });

    // 7. Set draft status = "approved".
    await tx.contentDraft.update({
      where: { id: draftId },
      data: { status: "approved" },
    });

    return { postId: post.id, draftId };
  });
}
