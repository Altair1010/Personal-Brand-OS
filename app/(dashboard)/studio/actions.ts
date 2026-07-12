"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { bumpDraftVersion } from "@/lib/content-engine/draftVersioning";
import { approveDraft } from "@/lib/content-engine/approveDraft";
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
export type CalendarPostDTO = {
  id: string;
  status: string;
};

export type CalendarDayDTO = {
  dayIndex: number;
  plannedObjective: string | null;
  pillarName: string | null;
  suggestedTopic: string | null;
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

  const version = await db.strategyVersion.findFirst({
    where: { strategyId: activeStrategyId },
    orderBy: { version: "desc" },
    include: {
      weeklyPlans: {
        include: {
          dailyPlans: {
            include: {
              plannedPillar: { select: { name: true } },
              posts: { select: { id: true, status: true } },
            },
          },
        },
      },
    },
  });
  if (!version) return { hasStrategy: false, days: [] };

  const days: CalendarDayDTO[] = version.weeklyPlans
    .flatMap((w) => w.dailyPlans)
    .sort((a, b) => a.dayIndex - b.dayIndex)
    .map((d) => {
      const post = d.posts[0] ?? null;
      return {
        dayIndex: d.dayIndex,
        plannedObjective: d.plannedObjective,
        pillarName: d.plannedPillar?.name ?? null,
        suggestedTopic: d.suggestedTopic,
        post: post ? { id: post.id, status: post.status } : null,
      };
    });

  return { hasStrategy: true, days };
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
    const draft = await db.contentDraft.create({
      data: {
        userId: USER_ID,
        version: 1,
        status: "draft",
        topic: "Bản nháp mới",
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
  if (v.tone !== undefined) dimUpdate.tone = v.tone;
  if (v.length !== undefined) dimUpdate.length = v.length;

  try {
    // bumpDraftVersion handles content + version + status; dims updated separately.
    const res = await bumpDraftVersion({
      draftId,
      hook,
      body,
      ending,
      hashtags: v.hashtags ?? [],
      imageSuggestion: v.imageSuggestion ?? "",
      contentMarkdown,
    });
    if (Object.keys(dimUpdate).length > 0) {
      await db.contentDraft.update({
        where: { id: draftId },
        data: dimUpdate,
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
): Promise<ActionResult<{ postId: string }>> {
  try {
    const res = await approveDraft(draftId);
    revalidatePath("/studio");
    revalidatePath(`/studio/${draftId}`);
    revalidatePath("/calendar");
    return { ok: true, data: { postId: res.postId } };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Duyệt bản nháp thất bại.",
    };
  }
}
