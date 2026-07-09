"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { OBJECTIVES } from "@/lib/constants";
import { normalizeRatioTo100 } from "@/lib/strategy-engine/normalizeRatio";

// Single-user local app: fixed ids match the seed (prisma/seed.ts).
const USER_ID = "local";
const APPSTATE_ID = "singleton";

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// --- Serializable shapes returned to the client ---
export type SegmentDTO = {
  id: string;
  name: string;
  pain: string | null;
  falseBelief: string | null;
  fear: string | null;
  desire: string | null;
  language: string | null;
  contentAngle: string | null;
  cta: string | null;
  offer: string | null;
  source: string;
};

export type PillarDTO = {
  id: string;
  name: string;
  description: string | null;
  ratioPercent: number;
  objectiveMix: Record<string, number> | null;
};

// --- Input validation (basic — client may send new items without id) ---
const segmentInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Persona cần tên"),
  pain: z.string().nullish(),
  falseBelief: z.string().nullish(),
  fear: z.string().nullish(),
  desire: z.string().nullish(),
  language: z.string().nullish(),
  contentAngle: z.string().nullish(),
  cta: z.string().nullish(),
  offer: z.string().nullish(),
  source: z.string().optional(),
});
export type SegmentInput = z.infer<typeof segmentInputSchema>;

const objectiveMixInputSchema = z
  .object(
    Object.fromEntries(OBJECTIVES.map((k) => [k, z.number()])) as Record<
      (typeof OBJECTIVES)[number],
      z.ZodNumber
    >,
  )
  .optional();

const pillarInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Pillar cần tên"),
  description: z.string().nullish(),
  ratioPercent: z.number().optional(),
  objectiveMix: objectiveMixInputSchema,
});
export type PillarInput = z.infer<typeof pillarInputSchema>;

// --- helpers ---
async function getActiveGoalId(): Promise<string | null> {
  const appState = await db.appState.findUnique({ where: { id: APPSTATE_ID } });
  return appState?.activeGoalId ?? null;
}

function toSegmentDTO(s: {
  id: string;
  name: string;
  pain: string | null;
  falseBelief: string | null;
  fear: string | null;
  desire: string | null;
  language: string | null;
  contentAngle: string | null;
  cta: string | null;
  offer: string | null;
  source: string;
}): SegmentDTO {
  return {
    id: s.id,
    name: s.name,
    pain: s.pain,
    falseBelief: s.falseBelief,
    fear: s.fear,
    desire: s.desire,
    language: s.language,
    contentAngle: s.contentAngle,
    cta: s.cta,
    offer: s.offer,
    source: s.source,
  };
}

function toPillarDTO(p: {
  id: string;
  name: string;
  description: string | null;
  ratioPercent: number;
  objectiveMix: Prisma.JsonValue;
}): PillarDTO {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    ratioPercent: p.ratioPercent,
    objectiveMix:
      p.objectiveMix && typeof p.objectiveMix === "object" && !Array.isArray(p.objectiveMix)
        ? (p.objectiveMix as Record<string, number>)
        : null,
  };
}

function revalidateAll() {
  revalidatePath("/audience-pillars");
  revalidatePath("/strategy");
}

// --- Read current audience/pillars state ---
export async function getAudiencePillarsData() {
  const [brandDna, appState] = await Promise.all([
    db.brandDNA.findUnique({ where: { userId: USER_ID } }),
    db.appState.findUnique({ where: { id: APPSTATE_ID } }),
  ]);
  const activeGoalId = appState?.activeGoalId ?? null;

  const [goal, segments, pillars] = await Promise.all([
    activeGoalId
      ? db.goal.findUnique({ where: { id: activeGoalId } })
      : Promise.resolve(null),
    activeGoalId
      ? db.audienceSegment.findMany({
          where: { userId: USER_ID, goalId: activeGoalId },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    activeGoalId
      ? db.contentPillar.findMany({
          where: { userId: USER_ID, goalId: activeGoalId, status: "active" },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return {
    brandDna,
    goal,
    segments: segments.map(toSegmentDTO),
    pillars: pillars.map(toPillarDTO),
    approvedAt: appState?.audienceApprovedAt
      ? appState.audienceApprovedAt.toISOString()
      : null,
  };
}

// --- Save personas: create/update by id + delete removed ones (scoped to goal) ---
export async function saveSegments(
  list: SegmentInput[],
): Promise<ActionResult<{ segments: SegmentDTO[] }>> {
  const parsed = z.array(segmentInputSchema).safeParse(list);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dữ liệu persona không hợp lệ",
    };
  }
  const goalId = await getActiveGoalId();
  if (!goalId) {
    return { ok: false, error: "Chưa có mục tiêu đang hoạt động" };
  }

  const items = parsed.data;

  await db.$transaction(async (tx) => {
    // Diff-delete: only among rows belonging to THIS user+goal.
    const existing = await tx.audienceSegment.findMany({
      where: { userId: USER_ID, goalId },
      select: { id: true },
    });
    const keepIds = new Set(
      items.map((it) => it.id).filter((id): id is string => !!id),
    );
    const toDelete = existing
      .map((e) => e.id)
      .filter((id) => !keepIds.has(id));
    if (toDelete.length > 0) {
      await tx.audienceSegment.deleteMany({
        where: { id: { in: toDelete }, userId: USER_ID, goalId },
      });
    }

    for (const it of items) {
      const data = {
        name: it.name,
        pain: it.pain ?? null,
        falseBelief: it.falseBelief ?? null,
        fear: it.fear ?? null,
        desire: it.desire ?? null,
        language: it.language ?? null,
        contentAngle: it.contentAngle ?? null,
        cta: it.cta ?? null,
        offer: it.offer ?? null,
        source: it.source ?? "ai",
      };
      if (it.id) {
        // update only if the row truly belongs to this user+goal (guard cross-goal writes)
        await tx.audienceSegment.updateMany({
          where: { id: it.id, userId: USER_ID, goalId },
          data,
        });
      } else {
        await tx.audienceSegment.create({
          data: { userId: USER_ID, goalId, ...data },
        });
      }
    }
  });

  const segments = await db.audienceSegment.findMany({
    where: { userId: USER_ID, goalId },
    orderBy: { createdAt: "asc" },
  });
  revalidateAll();
  return { ok: true, data: { segments: segments.map(toSegmentDTO) } };
}

// --- Save pillars: normalize ratio to 100 in CODE, then create/update + diff-delete ---
export async function savePillars(
  list: PillarInput[],
): Promise<ActionResult<{ pillars: PillarDTO[] }>> {
  const parsed = z.array(pillarInputSchema).safeParse(list);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dữ liệu pillar không hợp lệ",
    };
  }
  const goalId = await getActiveGoalId();
  if (!goalId) {
    return { ok: false, error: "Chưa có mục tiêu đang hoạt động" };
  }

  // Never trust incoming ratios — re-normalize to sum exactly 100 in code.
  const normalized = normalizeRatioTo100(
    parsed.data.map((p) => ({ ...p, ratioPercent: p.ratioPercent ?? 0 })),
    "ratioPercent",
  );

  await db.$transaction(async (tx) => {
    const existing = await tx.contentPillar.findMany({
      where: { userId: USER_ID, goalId, status: "active" },
      select: { id: true },
    });
    const keepIds = new Set(
      normalized.map((it) => it.id).filter((id): id is string => !!id),
    );
    const toDelete = existing
      .map((e) => e.id)
      .filter((id) => !keepIds.has(id));
    if (toDelete.length > 0) {
      await tx.contentPillar.deleteMany({
        where: { id: { in: toDelete }, userId: USER_ID, goalId },
      });
    }

    for (const it of normalized) {
      const data = {
        name: it.name,
        description: it.description ?? null,
        ratioPercent: it.ratioPercent,
        objectiveMix: (it.objectiveMix ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
      };
      if (it.id) {
        await tx.contentPillar.updateMany({
          where: { id: it.id, userId: USER_ID, goalId },
          data,
        });
      } else {
        await tx.contentPillar.create({
          data: { userId: USER_ID, goalId, status: "active", ...data },
        });
      }
    }
  });

  const pillars = await db.contentPillar.findMany({
    where: { userId: USER_ID, goalId, status: "active" },
    orderBy: { createdAt: "asc" },
  });
  revalidateAll();
  return { ok: true, data: { pillars: pillars.map(toPillarDTO) } };
}

// --- Approve gate: server-side guard (>=2 segments AND >=3 pillars, per MVP 3–5 rule) ---
export async function approveAudience(): Promise<ActionResult<{ approvedAt: string }>> {
  const goalId = await getActiveGoalId();
  if (!goalId) {
    return { ok: false, error: "Chưa có mục tiêu đang hoạt động" };
  }

  const [segmentCount, pillarCount] = await Promise.all([
    db.audienceSegment.count({ where: { userId: USER_ID, goalId } }),
    db.contentPillar.count({
      where: { userId: USER_ID, goalId, status: "active" },
    }),
  ]);

  if (segmentCount < 2 || pillarCount < 3) {
    return {
      ok: false,
      error: "Cần ít nhất 2 persona và 3 content pillar trước khi duyệt",
    };
  }

  const now = new Date();
  await db.appState.upsert({
    where: { id: APPSTATE_ID },
    update: { audienceApprovedAt: now },
    create: { id: APPSTATE_ID, audienceApprovedAt: now },
  });
  revalidateAll();
  return { ok: true, data: { approvedAt: now.toISOString() } };
}

// --- Reset approval flag (user edits after approving) ---
export async function resetApproval(): Promise<ActionResult> {
  await db.appState.upsert({
    where: { id: APPSTATE_ID },
    update: { audienceApprovedAt: null },
    create: { id: APPSTATE_ID, audienceApprovedAt: null },
  });
  revalidateAll();
  return { ok: true, data: undefined };
}
