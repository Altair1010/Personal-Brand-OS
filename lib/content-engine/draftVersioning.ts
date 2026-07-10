// M7 — bump ContentDraft.version khi regenerate/save nội dung mới.
// Giữ nguyên analytic dims (hookStyle/ctaIntensity/format/topic) — chỉ nội dung thay đổi.

import { db } from "@/lib/db";

export interface BumpDraftVersionArgs {
  draftId: string;
  hook?: string;
  body?: string;
  ending?: string;
  hashtags?: string[];
  imageSuggestion?: string;
  contentMarkdown?: string;
  aiPromptRunId?: string;
}

export interface BumpDraftVersionResult {
  draftId: string;
  newVersion: number;
}

/**
 * Tăng version của ContentDraft lên +1 và cập nhật nội dung mới.
 * Analytic dims (objectiveKey/pillarId/hookStyle/ctaIntensity/format/topic) được giữ nguyên
 * trừ khi caller truyền đè vào qua args.
 */
export async function bumpDraftVersion(
  args: BumpDraftVersionArgs,
): Promise<BumpDraftVersionResult> {
  const { draftId, ...content } = args;

  const draft = await db.contentDraft.findUnique({
    where: { id: draftId },
    select: { id: true, version: true, status: true },
  });
  if (!draft) {
    throw new Error(`ContentDraft không tồn tại: ${draftId}`);
  }
  if (draft.status === "approved") {
    throw new Error(
      `Draft "${draftId}" đã được approve — không thể bump version. Tạo draft mới thay thế.`,
    );
  }

  const newVersion = draft.version + 1;

  await db.contentDraft.update({
    where: { id: draftId },
    data: {
      version: newVersion,
      status: "draft", // reset về draft khi có nội dung mới
      ...(content.hook !== undefined && { hook: content.hook }),
      ...(content.body !== undefined && { body: content.body }),
      ...(content.ending !== undefined && { ending: content.ending }),
      ...(content.hashtags !== undefined && { hashtags: content.hashtags }),
      ...(content.imageSuggestion !== undefined && { imageSuggestion: content.imageSuggestion }),
      ...(content.contentMarkdown !== undefined && { contentMarkdown: content.contentMarkdown }),
      ...(content.aiPromptRunId !== undefined && { aiPromptRunId: content.aiPromptRunId }),
    },
  });

  return { draftId, newVersion };
}
