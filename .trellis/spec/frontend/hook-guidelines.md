# Hook Guidelines

> Hooks and data-fetching conventions in Personal Brand OS.

---

## Data Fetching = TanStack Query

Server state is fetched and cached with **TanStack Query** (`@tanstack/react-query`), not
raw `fetch` + `useEffect`.

- The `QueryClient` is created once in `components/Providers.tsx` (client) with project
  defaults: `staleTime: 30_000`, `refetchOnWindowFocus: false`.
- Mutations that write go through **server actions** (`"use server"`); on success,
  invalidate the affected query keys (or rely on the action's `revalidatePath`).
- Do NOT keep server data in a Zustand store or component state — that's TanStack Query's
  job (see state-management.md for the split).

```tsx
const { data, isLoading, error } = useQuery({
  queryKey: ["strategy", goalId],
  queryFn: () => getStrategy(goalId),  // server action
});
```

---

## Custom Hooks

- Extract stateful logic into a `use*` hook only when it is **reused** or when it
  meaningfully declutters a component. No speculative hooks for single use.
- A custom hook is a client concern — the file (or the hook's consumer) is `"use client"`.
- Keep hooks pure of side effects beyond their stated job; return a stable shape.

---

## Naming Conventions

- Hooks start with `use` (`useOnboardingStore`, `useStrategy`).
- Query hooks that wrap TanStack Query read as `useX` returning `{ data, isLoading, error }`.
- Zustand store hooks are named `useXStore` (`useOnboardingStore` in `lib/stores/onboarding.ts`).

---

## Zustand Selector Pattern

Select the **narrowest slice** to avoid needless re-renders — one selector per value:

```tsx
const brand = useOnboardingStore((s) => s.brand);
const patchBrand = useOnboardingStore((s) => s.patchBrand);
```

Do NOT destructure the whole store (`const { brand, patchBrand } = useOnboardingStore()`) —
that subscribes the component to every state change.

---

## Common Mistakes

- Fetching in `useEffect` and storing in `useState` instead of `useQuery`.
- Putting server data into Zustand (staleness + double source of truth).
- Selecting the entire store object → re-renders on unrelated updates.
- Forgetting to invalidate / revalidate after a mutating server action.
