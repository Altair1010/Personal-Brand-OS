"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { brandDnaSchema, type BrandDnaInput } from "@/lib/validators/brandDna";
import { goalSchema, type GoalInput } from "@/lib/validators/goal";

// Single-user local app: fixed ids match the seed (prisma/seed.ts).
const USER_ID = "local";
const APPSTATE_ID = "singleton";

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// --- BrandDNA (upsert on userId unique) ---
export async function saveBrandDna(
  input: BrandDnaInput,
): Promise<ActionResult> {
  const parsed = brandDnaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu Brand DNA không hợp lệ" };
  }
  const d = parsed.data;
  const data = {
    whoAmI: d.whoAmI,
    field: d.field,
    threeWords: d.threeWords ?? undefined,
    coreBeliefs: d.coreBeliefs,
    differentiation: d.differentiation,
    personalStory: d.personalStory,
    expertise: d.expertise,
    customerProfile: d.customerProfile,
    customerPain: d.customerPain,
    customerMisunderstanding: d.customerMisunderstanding,
    marketEducationGoal: d.marketEducationGoal,
    companyName: d.companyName,
    offers: d.offers ?? undefined,
    usp: d.usp,
    region: d.region,
    sourceFiles: d.sourceFiles ?? undefined,
  };

  await db.brandDNA.upsert({
    where: { userId: USER_ID },
    update: data,
    create: { userId: USER_ID, ...data },
  });
  revalidatePath("/onboarding");
  return { ok: true, data: undefined };
}

// --- Goal (update the active goal if present, else create + activate) ---
export async function saveGoal(
  input: GoalInput,
): Promise<ActionResult<{ goalId: string }>> {
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu mục tiêu không hợp lệ" };
  }
  const d = parsed.data;
  const data = {
    name: d.name,
    goalType: d.goalType,
    timeRangeStart: d.timeRangeStart,
    timeRangeEnd: d.timeRangeEnd,
    targetAudience: d.targetAudience,
    mainOffer: d.mainOffer,
    mainMessage: d.mainMessage,
    kpi: d.kpi ?? undefined,
    contentRatio: d.contentRatio ?? undefined,
    risk: d.risk,
    successDefinition: d.successDefinition,
  };

  const appState = await db.appState.findUnique({ where: { id: APPSTATE_ID } });
  const activeGoalId = appState?.activeGoalId ?? undefined;

  const goal = activeGoalId
    ? await db.goal.update({ where: { id: activeGoalId }, data })
    : await db.goal.create({ data: { userId: USER_ID, ...data } });

  await db.appState.upsert({
    where: { id: APPSTATE_ID },
    update: { activeGoalId: goal.id },
    create: { id: APPSTATE_ID, activeGoalId: goal.id },
  });

  revalidatePath("/onboarding");
  return { ok: true, data: { goalId: goal.id } };
}

// --- Read current onboarding state (for reload persistence) ---
export async function getOnboardingData() {
  const [brandDna, appState] = await Promise.all([
    db.brandDNA.findUnique({ where: { userId: USER_ID } }),
    db.appState.findUnique({ where: { id: APPSTATE_ID } }),
  ]);
  const goal = appState?.activeGoalId
    ? await db.goal.findUnique({ where: { id: appState.activeGoalId } })
    : null;
  return { brandDna, goal, activeGoalId: appState?.activeGoalId ?? null };
}
