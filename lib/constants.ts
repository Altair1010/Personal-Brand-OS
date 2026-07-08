// THE ONLY PLACE enum values are declared — import from here everywhere else.

export const OBJECTIVES = [
  "seo",
  "educate",
  "trust",
  "conversion",
  "story",
  "community",
] as const;

export const HOOK_STYLES = [
  "question",
  "contrarian",
  "story",
  "curiosity",
  "pain",
] as const;

export const CTA_INTENSITY = ["soft", "medium", "hard"] as const;

export const FORMATS = [
  "text",
  "image",
  "carousel",
  "video",
  "reel",
] as const;

export const POST_STATUS = [
  "idea",
  "draft",
  "approved",
  "posted",
  "analyzed",
] as const;

// Inferred union types
export type Objective = (typeof OBJECTIVES)[number];
export type HookStyle = (typeof HOOK_STYLES)[number];
export type CtaIntensity = (typeof CTA_INTENSITY)[number];
export type Format = (typeof FORMATS)[number];
export type PostStatus = (typeof POST_STATUS)[number];

// UI tag color map for Objective — Tailwind color tokens
export const OBJECTIVE_COLORS: Record<Objective, string> = {
  seo: "bg-cyan-100 text-cyan-800",
  educate: "bg-blue-100 text-blue-800",
  trust: "bg-violet-100 text-violet-800",
  conversion: "bg-amber-100 text-amber-800",
  story: "bg-rose-100 text-rose-800",
  community: "bg-emerald-100 text-emerald-800",
};
