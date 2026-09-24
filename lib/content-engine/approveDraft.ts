import { db } from "@/lib/db";

const USER_ID = "local";
const APP_STATE_ID = "singleton";

export interface ApproveDraftResult {
  postId: string;
  draftId: string;
}

export async function approveDraftOnly(
  draftId: string,
): Promise<{ draftId: string; status: "approved" }> {
  return db.$transaction(async (tx) => {
    const draft = await tx.contentDraft.findUnique({
      where: { id: draftId },
      include: { brand: { select: { status: true } } },
    });
    if (!draft) throw new Error(`ContentDraft không tồn tại: ${draftId}`);
    if (!draft.organizationId || !draft.brandId || !draft.brand) {
      throw new Error("H1_TENANT_SCOPE_REQUIRED");
    }
    if (draft.brand.status !== "ACTIVE") throw new Error("H1_BRAND_NOT_ACTIVE");
    if (draft.status === "posted") throw new Error("Bản nháp đã được xuất bản.");
    if (draft.status !== "approved") {
      await tx.contentDraft.update({
        where: { id: draftId },
        data: { status: "approved" },
      });
    }
    return { draftId, status: "approved" as const };
  });
}

export async function createPostFromApprovedDraft(
  draftId: string,
): Promise<ApproveDraftResult> {
  return db.$transaction(async (tx) => {
    const draft = await tx.contentDraft.findUnique({
      where: { id: draftId },
      include: {
        contentIdea: { select: { dailyPlanId: true } },
        brand: { select: { workspaceId: true, status: true } },
      },
    });
    if (!draft) throw new Error(`ContentDraft không tồn tại: ${draftId}`);
    if (draft.status !== "approved") {
      throw new Error("Hãy duyệt bản nháp trước khi tạo Post.");
    }

    const existingPost = await tx.post.findUnique({
      where: { contentDraftId: draftId },
      select: { id: true },
    });
    if (existingPost) return { postId: existingPost.id, draftId };

    if (!draft.organizationId || !draft.brandId || !draft.brand) {
      throw new Error("H1_TENANT_SCOPE_REQUIRED");
    }
    if (draft.brand.status !== "ACTIVE") throw new Error("H1_BRAND_NOT_ACTIVE");

    let dailyPlanId = draft.contentIdea?.dailyPlanId ?? null;
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

    if (strategyVersionId && !dailyPlanId) {
      const candidate = await tx.dailyPlan.findFirst({
        where: { weeklyPlan: { strategyVersionId } },
        orderBy: [{ dayIndex: "asc" }],
        select: { id: true },
      });
      dailyPlanId = candidate?.id ?? null;
      if (dailyPlanId) {
        if (draft.contentIdeaId) {
          await tx.contentIdea.update({
            where: { id: draft.contentIdeaId },
            data: { dailyPlanId },
          });
        } else {
          const idea = await tx.contentIdea.create({
            data: {
              dailyPlanId,
              userId: draft.userId,
              organizationId: draft.organizationId,
              brandId: draft.brandId,
              title: draft.topic?.trim() || "Nội dung Studio",
              objectiveKey: draft.objectiveKey,
              pillarId: draft.pillarId,
              source: "studio",
            },
            select: { id: true },
          });
          await tx.contentDraft.update({
            where: { id: draftId },
            data: { contentIdeaId: idea.id },
          });
        }
      }
    }

    if (!strategyVersionId || !dailyPlanId) {
      const missing: string[] = [];
      if (!strategyVersionId) missing.push("strategyVersionId");
      if (!dailyPlanId) missing.push("dailyPlanId");
      throw new Error(
        `Không thể tạo Post — thiếu attribution bắt buộc: ${missing.join(", ")}.`,
      );
    }

    const structuredText = [draft.hook, draft.body, draft.ending]
      .filter((value): value is string => Boolean(value?.trim()))
      .join("\n\n");
    const finalText = draft.contentMarkdown?.trim() || structuredText;

    const post = await tx.post.create({
      data: {
        contentDraftId: draftId,
        userId: USER_ID,
        organizationId: draft.organizationId,
        brandId: draft.brandId,
        strategyVersionId,
        dailyPlanId,
        finalText,
        platform: "facebook",
        status: "approved",
        objectiveKey: draft.objectiveKey,
        pillarId: draft.pillarId,
        hookStyle: draft.hookStyle,
        ctaIntensity: draft.ctaIntensity,
        format: draft.format,
        topic: draft.topic,
        publishedAt: null,
      },
    });

    await tx.contentDelivery.create({
      data: {
        organizationId: draft.organizationId,
        workspaceId: draft.brand.workspaceId,
        brandId: draft.brandId,
        postId: post.id,
        channel: "ORGANIC",
        provider: "facebook",
        state: "APPROVED",
      },
    });

    return { postId: post.id, draftId };
  });
}

// Backward-compatible composition for callers that still want one-step behavior.
export async function approveDraft(draftId: string): Promise<ApproveDraftResult> {
  await approveDraftOnly(draftId);
  return createPostFromApprovedDraft(draftId);
}
