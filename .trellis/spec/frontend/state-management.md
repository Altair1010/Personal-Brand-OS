# State Management

> How state is split in Personal Brand OS.

---

## The Split (project rule)

Two tools, non-overlapping jobs:

| State kind | Tool | Example |
|---|---|---|
| **Server state** (persisted data) | **TanStack Query** | goals, strategies, drafts, posts |
| **UI / transient state** | **Zustand** | onboarding wizard draft, open panels |
| **Local component state** | `useState` | a single input's controlled value, toggles |
| **URL state** | route params | `studio/[draftId]`, active route |

Rule of thumb: if the data lives in the database, it is **server state** → TanStack Query.
If it is ephemeral UI that never persists, it is **UI state** → Zustand or `useState`.

---

## Zustand for UI State

- Stores live in `lib/stores/*.ts`, created with `create<State>()`. See
  `lib/stores/onboarding.ts`.
- A store holds **in-progress UI** only. The onboarding store holds the 2-step wizard
  draft so switching steps doesn't lose input — persistence is done via server actions,
  not the store.
- Provide explicit action methods (`setStep`, `patchBrand`, `hydrate`) rather than
  exposing a raw setter. Patch immutably: `set((s) => ({ brand: { ...s.brand, ...patch } }))`.
- Seed from server data on mount via a `hydrate()` action + a `hydrated` flag.

---

## Server State

- Never mirror DB data into Zustand or `useState`. Read it with `useQuery`; mutate it
  with server actions and invalidate.
- Single-user local app: server reads use fixed ids that match the seed
  (`USER_ID = "local"`, `APPSTATE_ID = "singleton"` — see onboarding `actions.ts`).

---

## When to Promote to Global (Zustand)

Promote local `useState` to a Zustand store only when:

- multiple **sibling** components need the same transient value, AND
- it is not server data (that goes to TanStack Query instead).

Otherwise keep it local. Don't create a store for one component's toggle.

---

## Common Mistakes

- Server data in Zustand → stale UI, two sources of truth.
- Prop-drilling transient wizard state instead of a small store.
- A global store for state only one component reads.
