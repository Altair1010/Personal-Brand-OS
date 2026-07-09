import type { Objective } from "@/lib/constants";

// Serializable context passed from the server page to the client board. These are the
// only brand/goal fields the AI routes consume — nothing sensitive, never a Prisma row.
export interface BrandDnaContext {
  whoAmI?: string;
  field?: string;
  positioning?: string;
  threeWords?: string[];
  differentiationSharpened?: string;
  summary?: string;
}

export interface GoalContext {
  name: string;
  goalType: string;
  targetAudience?: string;
  mainOffer?: string;
}

// Client-side persona draft. `id` is undefined for AI-generated / newly-added rows until
// saved (server assigns a cuid). `_key` is a stable React list key independent of id.
export interface PersonaDraft {
  _key: string;
  id?: string;
  name: string;
  pain: string;
  falseBelief: string;
  fear: string;
  desire: string;
  language: string;
  contentAngle: string;
  cta: string;
  offer: string;
  source: string;
}

export type ObjectiveMix = Record<Objective, number>;

export interface PillarDraft {
  _key: string;
  id?: string;
  name: string;
  description: string;
  ratioPercent: number;
  objectiveMix: ObjectiveMix;
}
