import { create } from "zustand";
import type { BrandDnaInput } from "@/lib/validators/brandDna";
import type { GoalInput, KpiItem } from "@/lib/validators/goal";

type BrandDraft = BrandDnaInput;
type GoalDraft = Omit<GoalInput, "timeRangeStart" | "timeRangeEnd"> & {
  timeRangeStart?: string;
  timeRangeEnd?: string;
};

export type BrandSourceDocument = {
  fileName: string;
  text: string;
};

interface OnboardingState {
  step: 1 | 2;
  brand: BrandDraft;
  goal: GoalDraft;
  sourceDocuments: BrandSourceDocument[];
  analysisRequestId: number;
  hydrated: boolean;
  setStep: (step: 1 | 2) => void;
  patchBrand: (patch: Partial<BrandDraft>) => void;
  patchGoal: (patch: Partial<GoalDraft>) => void;
  setKpi: (kpi: KpiItem[]) => void;
  setContentRatio: (ratio: Record<string, number>) => void;
  addSourceDocument: (doc: BrandSourceDocument) => void;
  removeSourceDocument: (fileName: string) => void;
  hydrate: (data: { brand: BrandDraft; goal: GoalDraft }) => void;
}

const emptyGoal: GoalDraft = { name: "", goalType: "" };

export const useOnboardingStore = create<OnboardingState>((set) => ({
  step: 1,
  brand: {},
  goal: emptyGoal,
  sourceDocuments: [],
  analysisRequestId: 0,
  hydrated: false,
  setStep: (step) => set({ step }),
  patchBrand: (patch) => set((s) => ({ brand: { ...s.brand, ...patch } })),
  patchGoal: (patch) => set((s) => ({ goal: { ...s.goal, ...patch } })),
  setKpi: (kpi) => set((s) => ({ goal: { ...s.goal, kpi } })),
  setContentRatio: (contentRatio) =>
    set((s) => ({ goal: { ...s.goal, contentRatio } })),
  addSourceDocument: (doc) =>
    set((s) => ({
      sourceDocuments: [
        ...s.sourceDocuments.filter((item) => item.fileName !== doc.fileName),
        doc,
      ],
      brand: {
        ...s.brand,
        sourceFiles: Array.from(new Set([...(s.brand.sourceFiles ?? []), doc.fileName])),
      },
      analysisRequestId: s.analysisRequestId + 1,
    })),
  removeSourceDocument: (fileName) =>
    set((s) => ({
      sourceDocuments: s.sourceDocuments.filter((doc) => doc.fileName !== fileName),
      brand: {
        ...s.brand,
        sourceFiles: (s.brand.sourceFiles ?? []).filter((name) => name !== fileName),
      },
    })),
  hydrate: (data) =>
    set({ brand: data.brand, goal: data.goal, hydrated: true }),
}));
