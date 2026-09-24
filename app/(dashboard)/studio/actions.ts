"use server";

import { revalidatePath } from "next/cache";
import path from "node:path";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { bumpDraftVersion } from "@/lib/content-engine/draftVersioning";
import {
  approveDraftOnly,
  createPostFromApprovedDraft,
} from "@/lib/content-engine/approveDraft";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";
import { stableHash } from "@/lib/piltover/shared/contracts/stable-json";
import { createContentBrief, createChannelVariant, saveContentMaster } from "@/lib/piltover/vnext/content-engine";
import {
  OBJECTIVES,
  HOOK_STYLES,
  CTA_INTENSITY,
  FORMATS,
} from "@/lib/constants";

// Single-user local app: fixed ids match the seed (prisma/seed.ts).
const USER_ID = "local";
const APPSTATE_ID = "singleton";

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// --- z.enum guards from constants (never trust free-form enum strings) ---
const objectiveEnum = z.enum(OBJECTIVES);
const hookStyleEnum = z.enum(HOOK_STYLES);
const ctaIntensityEnum = z.enum(CTA_INTENSITY);
const formatEnum = z.enum(FORMATS);

// --- Json helper: ContentDraft.hashtags may be null → string[] ---
function asStringArray(v: Prisma.JsonValue | null | undefined): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : [];
}

function normalizeHashtag(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/^#+/, "").replace(/\s+/g, "").replace(/[^a-zA-Z0-9_]/g, "");
}

// ============================================================
// DTOs (serializable — Date → ISO string, Json parsed)
// ============================================================

export type StudioDraftDTO = {
  id: string;
  title: string;
  version: number;
  status: string;
  objectiveKey: string | null;
  topic: string | null;
  approved: boolean; // has a Post
  updatedAt: string;
};

export type StudioIdeaDTO = {
  id: string;
  title: string;
  objectiveKey: string | null;
  dailyPlanId: string | null;
};

export type StudioData = {
  drafts: StudioDraftDTO[];
  ideasWithoutDraft: StudioIdeaDTO[];
};

export type FrameworkDTO = {
  slug: string;
  name: string;
  summary: string | null;
};

export type DraftPersonaDTO = { name: string };

export type DraftContextDTO = {
  goalName: string | null;
  targetAudience: string | null;
  mainOffer: string | null;
  personas: DraftPersonaDTO[];
  brandDnaSummary: string | null;
};

export type DraftDTO = {
  id: string;
  title: string;
  version: number;
  status: string;
  approved: boolean;
  postId: string | null;
  objectiveKey: string | null;
  pillarId: string | null;
  framework: string | null;
  tone: string | null;
  length: string | null;
  hookStyle: string | null;
  ctaIntensity: string | null;
  format: string | null;
  topic: string | null;
  notes: string | null;
  description: string | null;
  hook: string | null;
  body: string | null;
  ending: string | null;
  hashtags: string[];
  imageSuggestion: string | null;
};

export type DraftEditorData = {
  draft: DraftDTO;
  frameworks: FrameworkDTO[];
  pillars: { id: string; name: string }[];
  context: DraftContextDTO;
};

// --- Calendar DTOs ---
export type CalendarAssetDTO = {
  id: string;
  sourceType: string;
  mediaType: string;
  fileName: string | null;
  mimeType: string | null;
  sourceUrl: string | null;
  sortOrder: number;
  status: string;
};

export type CalendarPostDTO = {
  id: string;
  status: string;
  finalText: string | null;
  scheduledAt: string | null;
  deliveryState: string | null;
};

export type CalendarDayDTO = {
  dailyPlanId: string;
  dayIndex: number;
  date: string | null;
  plannedObjective: string | null;
  pillarName: string | null;
  suggestedTopic: string | null;
  suggestedCta: string | null;
  draftId: string | null;
  draftStatus: string | null;
  content: string | null;
  assets: CalendarAssetDTO[];
  post: CalendarPostDTO | null;
};

export type CalendarData = {
  hasStrategy: boolean;
  days: CalendarDayDTO[];
};

// ============================================================
// Reads
// ============================================================

export async function getStudioData(): Promise<StudioData> {
  const [drafts, ideas] = await Promise.all([
    db.contentDraft.findMany({
      where: { userId: USER_ID },
      orderBy: { updatedAt: "desc" },
      include: {
        contentIdea: { select: { title: true } },
        post: { select: { id: true } },
      },
    }),
    db.contentIdea.findMany({
      where: { userId: USER_ID },
      orderBy: { createdAt: "desc" },
      include: { drafts: { select: { id: true } } },
    }),
  ]);

  return {
    drafts: drafts.map((d) => ({
      id: d.id,
      title: d.contentIdea?.title ?? d.topic ?? "Bản nháp không tiêu đề",
      version: d.version,
      status: d.status,
      objectiveKey: d.objectiveKey,
      topic: d.topic,
      approved: d.post !== null,
      updatedAt: d.updatedAt.toISOString(),
    })),
    ideasWithoutDraft: ideas
      .filter((i) => i.drafts.length === 0)
      .map((i) => ({
        id: i.id,
        title: i.title,
        objectiveKey: i.objectiveKey,
        dailyPlanId: i.dailyPlanId,
      })),
  };
}

export async function getDraft(draftId: string): Promise<DraftEditorData | null> {
  const draft = await db.contentDraft.findUnique({
    where: { id: draftId },
    include: {
      contentIdea: { select: { title: true } },
      post: { select: { id: true } },
    },
  });
  if (!draft || draft.userId !== USER_ID) return null;

  const appState = await db.appState.findUnique({ where: { id: APPSTATE_ID } });
  const activeGoalId = appState?.activeGoalId ?? null;

  const [brandDna, goal, personas, pillars, frameworks] = await Promise.all([
    db.brandDNA.findUnique({ where: { userId: USER_ID } }),
    activeGoalId
      ? db.goal.findUnique({ where: { id: activeGoalId } })
      : Promise.resolve(null),
    activeGoalId
      ? db.audienceSegment.findMany({
          where: { userId: USER_ID, goalId: activeGoalId },
          orderBy: { createdAt: "asc" },
          select: { name: true },
        })
      : Promise.resolve([]),
    activeGoalId
      ? db.contentPillar.findMany({
          where: { userId: USER_ID, goalId: activeGoalId, status: "active" },
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    db.framework.findMany({ orderBy: { name: "asc" } }),
  ]);

  const brandDnaSummary =
    [brandDna?.aiPositioning, brandDna?.differentiation, brandDna?.usp]
      .filter((v): v is string => !!v && v.trim().length > 0)
      .join(" | ") || null;

  return {
    draft: {
      id: draft.id,
      title: draft.contentIdea?.title ?? draft.topic ?? "Bản nháp",
      version: draft.version,
      status: draft.status,
      approved: draft.post !== null,
      postId: draft.post?.id ?? null,
      objectiveKey: draft.objectiveKey,
      pillarId: draft.pillarId,
      framework: draft.framework,
      tone: draft.tone,
      length: draft.length,
      hookStyle: draft.hookStyle,
      ctaIntensity: draft.ctaIntensity,
      format: draft.format,
      topic: draft.topic,
      notes: draft.notes,
      description: draft.description,
      hook: draft.hook,
      body: draft.body,
      ending: draft.ending,
      hashtags: asStringArray(draft.hashtags),
      imageSuggestion: draft.imageSuggestion,
    },
    frameworks: frameworks.map((f) => ({
      slug: f.slug,
      name: f.name,
      summary: f.summary,
    })),
    pillars: pillars.map((p) => ({ id: p.id, name: p.name })),
    context: {
      goalName: goal?.name ?? null,
      targetAudience: goal?.targetAudience ?? null,
      mainOffer: goal?.mainOffer ?? null,
      personas: personas.map((p) => ({ name: p.name })),
      brandDnaSummary,
    },
  };
}

export async function getCalendarData(): Promise<CalendarData> {
  const appState = await db.appState.findUnique({ where: { id: APPSTATE_ID } });
  const activeStrategyId = appState?.activeStrategyId ?? null;
  if (!activeStrategyId) return { hasStrategy: false, days: [] };

  const [version, goal] = await Promise.all([
    db.strategyVersion.findFirst({
      where: { strategyId: activeStrategyId },
      orderBy: { version: "desc" },
      include: {
        weeklyPlans: {
          include: {
            dailyPlans: {
              include: {
                plannedPillar: { select: { name: true } },
                posts: {
                  include: { delivery: true },
                },
                ideas: {
                  include: {
                    drafts: {
                      include: {
                        assets: { orderBy: { sortOrder: "asc" } },
                        post: { include: { delivery: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    appState?.activeGoalId
      ? db.goal.findUnique({
          where: { id: appState.activeGoalId },
          select: { timeRangeStart: true, timeRangeEnd: true },
        })
      : Promise.resolve(null),
  ]);
  if (!version) return { hasStrategy: false, days: [] };

  const fallbackStart = goal?.timeRangeStart ?? null;
  const dateForIndex = (index: number) => {
    if (!fallbackStart) return null;
    return new Date(
      fallbackStart.getFullYear(),
      fallbackStart.getMonth(),
      fallbackStart.getDate() + index - 1,
      12,
      0,
      0,
      0,
    );
  };

  const days: CalendarDayDTO[] = version.weeklyPlans
    .flatMap((w) => w.dailyPlans)
    .sort((a, b) => a.dayIndex - b.dayIndex)
    .map((d) => {
      const drafts = d.ideas
        .flatMap((idea) => idea.drafts)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      const directPost = d.posts[0] ?? null;
      const draft =
        (directPost
          ? drafts.find((candidate) => candidate.id === directPost.contentDraftId)
          : null) ??
        drafts[0] ??
        null;
      const post = directPost ?? draft?.post ?? null;
      const date = post?.delivery?.scheduledAt ?? d.date ?? dateForIndex(d.dayIndex);
      const structured = draft
        ? [draft.hook, draft.body, draft.ending]
            .filter((value): value is string => Boolean(value?.trim()))
            .join("\n\n")
        : "";
      return {
        dailyPlanId: d.id,
        dayIndex: d.dayIndex,
        date: date?.toISOString() ?? null,
        plannedObjective: d.plannedObjective,
        pillarName: d.plannedPillar?.name ?? null,
        suggestedTopic: d.suggestedTopic,
        suggestedCta: d.suggestedCta,
        draftId: draft?.id ?? null,
        draftStatus: draft?.status ?? null,
        content: (post?.finalText ?? draft?.contentMarkdown ?? structured) || null,
        assets: (draft?.assets ?? []).map((asset) => ({
          id: asset.id,
          sourceType: asset.sourceType,
          mediaType: asset.mediaType,
          fileName: asset.fileName,
          mimeType: asset.mimeType,
          sourceUrl: asset.sourceUrl,
          sortOrder: asset.sortOrder,
          status: asset.status,
        })),
        post: post
          ? {
              id: post.id,
              status: post.status,
              finalText: post.finalText,
              scheduledAt: post.delivery?.scheduledAt?.toISOString() ?? null,
              deliveryState: post.delivery?.state ?? null,
            }
          : null,
      };
    });

  days.sort((a, b) => {
    const left = a.date ? new Date(a.date).getTime() : Number.MAX_SAFE_INTEGER;
    const right = b.date ? new Date(b.date).getTime() : Number.MAX_SAFE_INTEGER;
    return left - right || a.dayIndex - b.dayIndex;
  });

  return { hasStrategy: true, days };
}

// ============================================================
// Publishing sync for Calendar composer
// ============================================================

async function syncScheduledPublishingPayload(draftId: string): Promise<void> {
  const draft = await db.contentDraft.findUnique({
    where: { id: draftId },
    include: {
      assets: { orderBy: { sortOrder: "asc" } },
      post: {
        include: {
          delivery: true,
          facebookAccount: { select: { id: true } },
        },
      },
    },
  });
  const post = draft?.post;
  const scheduledAt = post?.delivery?.scheduledAt ?? null;
  const accountId = post?.facebookAccount?.id ?? null;
  if (!draft || !post || !scheduledAt || !accountId) return;

  const media = draft.assets.map((asset) => ({
    assetId: asset.id,
    sourceType: asset.sourceType,
    mediaType: asset.mediaType,
    fileName: asset.fileName,
    mimeType: asset.mimeType,
    localPath: asset.localPath,
    sourceUrl: asset.sourceUrl,
    sortOrder: asset.sortOrder,
  }));
  const providerPayload = {
    text: post.finalText ?? draft.contentMarkdown ?? "",
    format:
      media.length === 0
        ? "text"
        : media.length > 1
          ? "carousel"
          : media[0]?.mediaType === "VIDEO"
            ? "video"
            : "image",
    media,
  };
  const payloadFingerprint = stableHash(providerPayload);
  await db.publishingJob.updateMany({
    where: {
      contentVariantId: post.id,
      status: { in: ["QUEUED", "RETRY_PENDING", "WAITING_APPROVAL", "BLOCKED"] },
      providerPostId: null,
    },
    data: {
      integrationId: `facebook:${accountId}`,
      scheduledAt,
      providerPayload: providerPayload as Prisma.InputJsonValue,
      payloadFingerprint,
      status: "QUEUED",
      nextAttemptAt: scheduledAt,
      blockedReason: null,
      error: null,
      errorCategory: null,
      leaseOwner: null,
      leaseExpiresAt: null,
    },
  });
}

// ============================================================
// Mutations
// ============================================================

export async function createDraftFromIdea(
  ideaId: string,
): Promise<ActionResult<{ draftId: string }>> {
  const idea = await db.contentIdea.findUnique({ where: { id: ideaId } });
  if (!idea || idea.userId !== USER_ID) {
    return { ok: false, error: "Không tìm thấy ý tưởng." };
  }

  const draft = await db.contentDraft.create({
    data: {
      contentIdeaId: idea.id,
      userId: USER_ID,
      organizationId: idea.organizationId,
      brandId: idea.brandId,
      version: 1,
      status: "draft",
      objectiveKey: idea.objectiveKey,
      pillarId: idea.pillarId,
      topic: idea.title,
    },
    select: { id: true },
  });

  revalidatePath("/studio");
  return { ok: true, data: { draftId: draft.id } };
}

// Quick-create (EM2b T5): a blank draft, no ContentIdea attached. Studio treats a null
// contentIdea by falling back to `topic` for the title.
export async function createBlankDraft(): Promise<
  ActionResult<{ draftId: string }>
> {
  try {
    const tenant = await resolveLocalTenant(db);
    const draft = await db.contentDraft.create({
      data: {
        userId: USER_ID,
        organizationId: tenant.organizationId,
        brandId: tenant.brandId,
        version: 1,
        status: "draft",
        topic: "",
      },
      select: { id: true },
    });
    revalidatePath("/studio");
    return { ok: true, data: { draftId: draft.id } };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Tạo bản nháp thất bại.",
    };
  }
}

export async function ensureCalendarDraft(
  dailyPlanId: string,
): Promise<ActionResult<{ draftId: string }>> {
  try {
    const tenant = await resolveLocalTenant(db);
    const dailyPlan = await db.dailyPlan.findUnique({
      where: { id: dailyPlanId },
      include: {
        weeklyPlan: {
          include: { strategyVersion: { include: { strategy: true } } },
        },
        ideas: {
          orderBy: { createdAt: "asc" },
          include: { drafts: { orderBy: { updatedAt: "desc" } } },
        },
      },
    });
    if (!dailyPlan) return { ok: false, error: "Không tìm thấy ngày trong chiến lược." };
    if (
      dailyPlan.weeklyPlan.strategyVersion.strategy.organizationId !== tenant.organizationId ||
      dailyPlan.weeklyPlan.strategyVersion.strategy.brandId !== tenant.brandId
    ) {
      return { ok: false, error: "Ngày này không thuộc brand hiện tại." };
    }

    const existing = dailyPlan.ideas.flatMap((idea) => idea.drafts)[0];
    if (existing) return { ok: true, data: { draftId: existing.id } };

    let idea = dailyPlan.ideas[0] ?? null;
    if (!idea) {
      idea = await db.contentIdea.create({
        data: {
          dailyPlanId: dailyPlan.id,
          userId: USER_ID,
          organizationId: tenant.organizationId,
          brandId: tenant.brandId,
          title: dailyPlan.suggestedTopic?.trim() || `Nội dung ngày ${dailyPlan.dayIndex}`,
          objectiveKey: dailyPlan.plannedObjective,
          pillarId: dailyPlan.plannedPillarId,
          source: "calendar",
        },
        include: { drafts: true },
      });
    }

    const initialText = [dailyPlan.suggestedTopic, dailyPlan.suggestedCta]
      .filter((value): value is string => Boolean(value?.trim()))
      .join("\n\n");
    const draft = await db.contentDraft.create({
      data: {
        contentIdeaId: idea.id,
        userId: USER_ID,
        organizationId: tenant.organizationId,
        brandId: tenant.brandId,
        version: 1,
        status: "draft",
        objectiveKey: dailyPlan.plannedObjective,
        pillarId: dailyPlan.plannedPillarId,
        topic: dailyPlan.suggestedTopic,
        body: initialText,
        contentMarkdown: initialText,
      },
      select: { id: true },
    });
    revalidatePath("/calendar");
    revalidatePath("/studio");
    return { ok: true, data: { draftId: draft.id } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Không tạo được composer cho ngày này.",
    };
  }
}

export async function saveCalendarComposer(
  draftId: string,
  text: string,
): Promise<ActionResult<{ version: number }>> {
  try {
    const draft = await db.contentDraft.findUnique({
      where: { id: draftId },
      include: { post: { select: { id: true } } },
    });
    if (!draft || draft.userId !== USER_ID) return { ok: false, error: "Không tìm thấy bản nháp." };
    const clean = text.trim();
    const updated = await db.contentDraft.update({
      where: { id: draftId },
      data: {
        hook: null,
        body: clean,
        ending: null,
        contentMarkdown: clean,
        version: { increment: 1 },
        status: draft.post ? draft.status : "draft",
      },
      select: { version: true },
    });
    if (draft.post) {
      await db.post.update({
        where: { id: draft.post.id },
        data: { finalText: clean },
      });
    }
    await syncScheduledPublishingPayload(draftId);
    revalidatePath("/calendar");
    revalidatePath(`/studio/${draftId}`);
    return { ok: true, data: { version: updated.version } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Không lưu được nội dung.",
    };
  }
}

const calendarAssetSchema = z.object({
  draftId: z.string().min(1),
  sourceType: z.enum(["UPLOAD", "GOOGLE_DRIVE"]),
  fileName: z.string().trim().max(255).optional(),
  mimeType: z.string().trim().max(160).optional(),
  localPath: z.string().trim().optional(),
  sourceUrl: z.string().url().optional(),
});

export async function addCalendarAsset(
  input: z.input<typeof calendarAssetSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = calendarAssetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Attachment không hợp lệ." };
  try {
    const draft = await db.contentDraft.findUnique({
      where: { id: parsed.data.draftId },
      select: { id: true, userId: true },
    });
    if (!draft || draft.userId !== USER_ID) return { ok: false, error: "Không tìm thấy bản nháp." };

    if (parsed.data.sourceType === "UPLOAD") {
      if (!parsed.data.localPath) return { ok: false, error: "Upload chưa có localPath." };
      const artifactRoot = process.env.LOCALAPPDATA
        ? path.resolve(process.env.LOCALAPPDATA, "Piltover", "artifacts")
        : path.resolve(process.cwd(), ".piltover", "artifacts");
      const candidate = path.resolve(parsed.data.localPath);
      if (!candidate.startsWith(artifactRoot + path.sep)) {
        return { ok: false, error: "Đường dẫn upload không thuộc Piltover artifact store." };
      }
    } else {
      if (!parsed.data.sourceUrl) return { ok: false, error: "Thiếu Google Drive link." };
      const url = new URL(parsed.data.sourceUrl);
      if (!["drive.google.com", "docs.google.com"].includes(url.hostname)) {
        return { ok: false, error: "Chỉ hỗ trợ Google Drive link ở mục này." };
      }
    }

    const mime = parsed.data.mimeType?.toLowerCase() ?? "";
    const mediaType = mime.startsWith("image/")
      ? "IMAGE"
      : mime.startsWith("video/")
        ? "VIDEO"
        : "FILE";
    const last = await db.contentAsset.findFirst({
      where: { contentDraftId: draft.id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const asset = await db.contentAsset.create({
      data: {
        contentDraftId: draft.id,
        sourceType: parsed.data.sourceType,
        mediaType,
        fileName: parsed.data.fileName ?? (parsed.data.sourceType === "GOOGLE_DRIVE" ? "Google Drive media" : null),
        mimeType: parsed.data.mimeType,
        localPath: parsed.data.localPath,
        sourceUrl: parsed.data.sourceUrl,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        status: parsed.data.sourceType === "GOOGLE_DRIVE" ? "REMOTE" : "READY",
      },
      select: { id: true },
    });
    await syncScheduledPublishingPayload(draft.id);
    revalidatePath("/calendar");
    return { ok: true, data: asset };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Không thêm được attachment.",
    };
  }
}

export async function removeCalendarAsset(
  assetId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const asset = await db.contentAsset.findUnique({
      where: { id: assetId },
      include: { contentDraft: { select: { userId: true } } },
    });
    if (!asset || asset.contentDraft.userId !== USER_ID) return { ok: false, error: "Không tìm thấy attachment." };
    await db.contentAsset.delete({ where: { id: assetId } });
    await syncScheduledPublishingPayload(asset.contentDraftId);
    revalidatePath("/calendar");
    return { ok: true, data: { id: assetId } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Không xóa được attachment." };
  }
}

export async function reorderCalendarAssets(
  draftId: string,
  assetIds: string[],
): Promise<ActionResult> {
  try {
    const assets = await db.contentAsset.findMany({
      where: { contentDraftId: draftId },
      select: { id: true, contentDraft: { select: { userId: true } } },
    });
    if (assets.some((asset) => asset.contentDraft.userId !== USER_ID)) {
      return { ok: false, error: "Không có quyền thay đổi attachment." };
    }
    const owned = new Set(assets.map((asset) => asset.id));
    if (assetIds.length !== assets.length || assetIds.some((id) => !owned.has(id))) {
      return { ok: false, error: "Thứ tự attachment không hợp lệ." };
    }
    await db.$transaction(
      assetIds.map((id, index) =>
        db.contentAsset.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );
    await syncScheduledPublishingPayload(draftId);
    revalidatePath("/calendar");
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Không đổi được thứ tự attachment." };
  }
}

export async function deleteDraftAction(
  draftId: string,
): Promise<ActionResult<{ deletedId: string }>> {
  try {
    const draft = await db.contentDraft.findUnique({
      where: { id: draftId },
      select: { id: true, userId: true, status: true, post: { select: { id: true } } },
    });
    if (!draft || draft.userId !== USER_ID) {
      return { ok: false, error: "Không tìm thấy bản nháp." };
    }
    if (draft.post || draft.status === "approved" || draft.status === "posted") {
      return { ok: false, error: "Không thể xóa bản nháp đã duyệt hoặc đã xuất bản." };
    }
    await db.contentDraft.delete({ where: { id: draftId } });
    revalidatePath("/studio");
    return { ok: true, data: { deletedId: draftId } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Xóa bản nháp thất bại.",
    };
  }
}

export async function prepareContentBriefForDraft(
  draftId: string,
  input: {
    objective: string;
    audienceRef?: string;
    format: string;
    channel: string;
    tone?: string;
    intensity?: string;
    hookDirection?: string;
    length?: string;
    cta?: string;
    keyMessage?: string;
    offer?: string;
  },
): Promise<ActionResult<{ briefId: string }>> {
  const draft = await db.contentDraft.findUnique({ where: { id: draftId } });
  if (!draft || draft.userId !== USER_ID) return { ok: false, error: "Không tìm thấy bản nháp." };
  try {
    const brief = await createContentBrief(db, {
      objective: input.objective,
      audienceRef: input.audienceRef,
      format: input.format,
      channel: input.channel,
      tone: input.tone,
      intensity: input.intensity,
      hookDirection: input.hookDirection,
      length: input.length,
      cta: input.cta,
      keyMessage: input.keyMessage,
      offer: input.offer,
    });
    await db.contentDraft.update({ where: { id: draftId }, data: { contentBriefId: brief.id } });
    return { ok: true, data: { briefId: brief.id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không tạo được ContentBrief." };
  }
}

const saveDraftSchema = z.object({
  hook: z.string().optional(),
  body: z.string().optional(),
  ending: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  imageSuggestion: z.string().optional(),
  objectiveKey: z.string().optional(),
  framework: z.string().optional(),
  hookStyle: z.string().optional(),
  ctaIntensity: z.string().optional(),
  format: z.string().optional(),
  topic: z.string().optional(),
  notes: z.string().optional(),
  description: z.string().optional(),
  tone: z.string().optional(),
  length: z.string().optional(),
});

export type SaveDraftInput = z.input<typeof saveDraftSchema>;

export async function saveDraft(
  draftId: string,
  input: SaveDraftInput,
): Promise<ActionResult<{ version: number }>> {
  const parsed = saveDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dữ liệu bản nháp không hợp lệ." };
  }
  const v = parsed.data;

  const hook = v.hook ?? "";
  const body = v.body ?? "";
  const ending = v.ending ?? "";
  const contentMarkdown = [hook, body, ending].join("\n\n");

  // Analytic dims — chỉ lưu giá trị hợp lệ theo enum; giá trị ngoài enum → bỏ qua field.
  const dimUpdate: Prisma.ContentDraftUpdateInput = {};
  if (v.objectiveKey !== undefined) {
    const r = objectiveEnum.safeParse(v.objectiveKey);
    if (r.success) dimUpdate.objectiveKey = r.data;
  }
  if (v.hookStyle !== undefined) {
    const r = hookStyleEnum.safeParse(v.hookStyle);
    if (r.success) dimUpdate.hookStyle = r.data;
  }
  if (v.ctaIntensity !== undefined) {
    const r = ctaIntensityEnum.safeParse(v.ctaIntensity);
    if (r.success) dimUpdate.ctaIntensity = r.data;
  }
  if (v.format !== undefined) {
    const r = formatEnum.safeParse(v.format);
    if (r.success) dimUpdate.format = r.data;
  }
  // framework/topic/tone/length are free text (not constants enums).
  if (v.framework !== undefined) dimUpdate.framework = v.framework;
  if (v.topic !== undefined) dimUpdate.topic = v.topic;
  if (v.notes !== undefined) dimUpdate.notes = v.notes;
  if (v.description !== undefined) dimUpdate.description = v.description;
  if (v.tone !== undefined) dimUpdate.tone = v.tone;
  if (v.length !== undefined) dimUpdate.length = v.length;

  try {
    // bumpDraftVersion handles content + version + status; dims updated separately.
    const res = await bumpDraftVersion({
      draftId,
      hook,
      body,
      ending,
      hashtags: (v.hashtags ?? []).map(normalizeHashtag).filter(Boolean),
      imageSuggestion: v.imageSuggestion ?? "",
      contentMarkdown,
    });
    if (Object.keys(dimUpdate).length > 0) {
      await db.contentDraft.update({
        where: { id: draftId },
        data: dimUpdate,
      });
    }

    const persisted = await db.contentDraft.findUnique({
      where: { id: draftId },
      select: {
        contentBriefId: true,
        format: true,
        hook: true,
        body: true,
        ending: true,
        hashtags: true,
        imageSuggestion: true,
      },
    });
    if (persisted?.contentBriefId) {
      const hashtags = asStringArray(persisted.hashtags).map(normalizeHashtag).filter(Boolean);
      const format = persisted.format ?? "text";
      const lines = (persisted.body ?? "").split(/\n+/).map((item) => item.trim()).filter(Boolean);
      const payload =
        format === "carousel"
          ? {
              schemaType: "CAROUSEL" as const,
              data: {
                cover: { headline: persisted.hook ?? "", visualDirection: persisted.imageSuggestion ?? undefined },
                slides: (lines.length >= 2 ? lines : [persisted.body ?? "", persisted.ending ?? ""]).map((item, index) => ({
                  headline: `Slide ${index + 1}`,
                  body: item,
                  visualDirection: persisted.imageSuggestion ?? undefined,
                })),
                finalSlide: { headline: "CTA", cta: persisted.ending ?? "" },
                caption: [persisted.hook, persisted.body, persisted.ending].filter(Boolean).join("\n\n"),
                hashtags,
              },
            }
          : format === "video" || format === "reel"
            ? {
                schemaType: format === "video" ? "VIDEO" as const : "REEL" as const,
                data: {
                  hook: persisted.hook ?? "",
                  scenes: (lines.length ? lines : [persisted.body ?? ""]).map((item, index) => ({
                    duration: "auto",
                    visual: persisted.imageSuggestion ?? `Scene ${index + 1}`,
                    voiceover: item,
                    overlay: index === 0 ? persisted.hook ?? undefined : undefined,
                  })),
                  cta: persisted.ending ?? "",
                  caption: [persisted.hook, persisted.body, persisted.ending].filter(Boolean).join("\n\n"),
                  hashtags,
                },
              }
            : format === "image"
              ? {
                  schemaType: "IMAGE_POST" as const,
                  data: {
                    caption: [persisted.hook, persisted.body, persisted.ending].filter(Boolean).join("\n\n"),
                    hook: persisted.hook ?? "",
                    body: persisted.body ?? "",
                    cta: persisted.ending ?? "",
                    hashtags,
                    visualBrief: persisted.imageSuggestion ?? "",
                  },
                }
              : {
                  schemaType: "TEXT_POST" as const,
                  data: {
                    hook: persisted.hook ?? "",
                    body: persisted.body ?? "",
                    cta: persisted.ending ?? "",
                    hashtags,
                  },
                };
      const { master } = await saveContentMaster(db, { briefId: persisted.contentBriefId, payload });
      await createChannelVariant(db, {
        contentMasterId: master.id,
        channel: "facebook",
        format,
        content: payload.data,
      });
    }

    revalidatePath("/studio");
    revalidatePath(`/studio/${draftId}`);
    return { ok: true, data: { version: res.newVersion } };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Lưu bản nháp thất bại.",
    };
  }
}

export async function approveDraftAction(
  draftId: string,
): Promise<ActionResult<{ status: "approved" }>> {
  try {
    const draft = await db.contentDraft.findUnique({
      where: { id: draftId },
      select: { contentBriefId: true },
    });
    if (draft?.contentBriefId) {
      const master = await db.contentMaster.findFirst({
        where: { contentBriefId: draft.contentBriefId },
        orderBy: { version: "desc" },
      });
      if (master) {
        const gate = await db.qualityGate.findFirst({
          where: { artifactType: "CONTENT_MASTER", artifactId: master.id },
          orderBy: { createdAt: "desc" },
        });
        if (!gate || gate.status !== "PASS") {
          return { ok: false, error: "Quality gate chưa PASS. Hãy sửa nội dung trước khi duyệt." };
        }
      }
    }
    await approveDraftOnly(draftId);
    revalidatePath("/studio");
    revalidatePath(`/studio/${draftId}`);
    return { ok: true, data: { status: "approved" } };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Duyệt bản nháp thất bại.",
    };
  }
}

export async function createPostAction(
  draftId: string,
): Promise<ActionResult<{ postId: string }>> {
  try {
    const result = await createPostFromApprovedDraft(draftId);
    revalidatePath("/studio");
    revalidatePath(`/studio/${draftId}`);
    revalidatePath("/calendar");
    revalidatePath("/campaigns");
    return { ok: true, data: { postId: result.postId } };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Tạo Post thất bại.",
    };
  }
}
