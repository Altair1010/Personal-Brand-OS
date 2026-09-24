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

export const METRIC_SOURCES = ["manual", "facebook_api"] as const;

// Inferred union types
export type Objective = (typeof OBJECTIVES)[number];
export type HookStyle = (typeof HOOK_STYLES)[number];
export type CtaIntensity = (typeof CTA_INTENSITY)[number];
export type Format = (typeof FORMATS)[number];
export type PostStatus = (typeof POST_STATUS)[number];
export type MetricSource = (typeof METRIC_SOURCES)[number];

// UI tag color map for Objective — Tailwind color tokens
export const OBJECTIVE_COLORS: Record<Objective, string> = {
  seo: "bg-[#D7E1DC] text-[#0C4F54]",
  educate: "bg-[#DCE4DD] text-[#184F52]",
  trust: "bg-[#E2DDD0] text-[#5E5548]",
  conversion: "bg-[#E5D8C2] text-[#73532C]",
  story: "bg-[#EAD5D1] text-[#87423C]",
  community: "bg-[#DCE5D9] text-[#315B48]",
};
