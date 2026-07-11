import { create } from "zustand";

// UI state (Zustand per CLAUDE.md): which linked Facebook Page the dashboard is
// currently scoped to. null = "Tất cả trang" (no filter). The active id is also
// mirrored into the URL (?fb=) by AccountSwitcher so server components can scope reads.

interface FacebookState {
  activeFacebookAccountId: string | null;
  setActiveFacebookAccount: (id: string | null) => void;
}

export const useFacebookStore = create<FacebookState>((set) => ({
  activeFacebookAccountId: null,
  setActiveFacebookAccount: (id) => set({ activeFacebookAccountId: id }),
}));
