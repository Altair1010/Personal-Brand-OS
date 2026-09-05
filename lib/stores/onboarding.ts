import { create } from "zustand";
import type { BrandDnaInput } from "@/lib/validators/brandDna";
import type { GoalInput, KpiItem } from "@/lib/validators/goal";

// Transient wizard state (Zustand UI state). Server persistence is via the
// onboarding server actions; this store only holds the in-progress draft across the 2 steps
// so a step switch doesn't lose input. Seeded from server data on mount.

type BrandDraft = BrandDnaInput;
type GoalDraft = Omit<GoalInput, "timeRangeStart" | "timeRangeEnd"> & {
  timeRangeStart?: string;
  timeRangeEnd?: string;
};

interface OnboardingState {
  step: 1 | 2;
  brand: BrandDraft;
  goal: GoalDraft;
  hydrated: boolean;
  setStep: (step: 1 | 2) => void;
  patchBrand: (patch: Partial<BrandDraft>) => void;
  patchGoal: (patch: Partial<GoalDraft>) => void;
  setKpi: (kpi: KpiItem[]) => void;
  setContentRatio: (ratio: Record<string, number>) => void;
  hydrate: (data: { brand: BrandDraft; goal: GoalDraft }) => void;
}

const emptyGoal: GoalDraft = { name: "", goalType: "" };

export const useOnboardingStore = create<OnboardingState>((set) => ({
  step: 1,
  brand: {},
  goal: emptyGoal,
  hydrated: false,
  setStep: (step) => set({ step }),
  patchBrand: (patch) => set((s) => ({ brand: { ...s.brand, ...patch } })),
  patchGoal: (patch) => set((s) => ({ goal: { ...s.goal, ...patch } })),
  setKpi: (kpi) => set((s) => ({ goal: { ...s.goal, kpi } })),
  setContentRatio: (contentRatio) =>
    set((s) => ({ goal: { ...s.goal, contentRatio } })),
  hydrate: (data) =>
    set({ brand: data.brand, goal: data.goal, hydrated: true }),
}));
