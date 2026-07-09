import { OBJECTIVES, type Objective } from "@/lib/constants";
import type {
  ObjectiveMix,
  PersonaDraft,
  PillarDraft,
} from "./types";
import type { SegmentDTO, PillarDTO } from "@/app/(dashboard)/audience-pillars/actions";

let counter = 0;
// Stable-per-session react key for draft rows without a DB id yet.
export function newKey(): string {
  counter += 1;
  return `draft-${counter}-${Date.now().toString(36)}`;
}

// Even objectiveMix across the 6 fixed objectives (sums to ~100 before code-normalize).
export function emptyObjectiveMix(): ObjectiveMix {
  const base = Math.floor(100 / OBJECTIVES.length);
  const mix = {} as ObjectiveMix;
  OBJECTIVES.forEach((k, i) => {
    mix[k] = base + (i < 100 - base * OBJECTIVES.length ? 1 : 0);
  });
  return mix;
}

// Coerce an unknown record (AI output) into a strict 6-key ObjectiveMix. Enum keys come
// ONLY from OBJECTIVES — any extra key the model invents is dropped.
export function coerceObjectiveMix(raw: unknown): ObjectiveMix {
  const mix = {} as ObjectiveMix;
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  for (const k of OBJECTIVES as readonly Objective[]) {
    const v = src[k];
    mix[k] = typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
  }
  return mix;
}

export function segmentToDraft(s: SegmentDTO): PersonaDraft {
  return {
    _key: newKey(),
    id: s.id,
    name: s.name,
    pain: s.pain ?? "",
    falseBelief: s.falseBelief ?? "",
    fear: s.fear ?? "",
    desire: s.desire ?? "",
    language: s.language ?? "",
    contentAngle: s.contentAngle ?? "",
    cta: s.cta ?? "",
    offer: s.offer ?? "",
    source: s.source,
  };
}

export function pillarToDraft(p: PillarDTO): PillarDraft {
  return {
    _key: newKey(),
    id: p.id,
    name: p.name,
    description: p.description ?? "",
    ratioPercent: p.ratioPercent,
    objectiveMix: coerceObjectiveMix(p.objectiveMix),
  };
}

export function emptyPersona(): PersonaDraft {
  return {
    _key: newKey(),
    name: "",
    pain: "",
    falseBelief: "",
    fear: "",
    desire: "",
    language: "",
    contentAngle: "",
    cta: "",
    offer: "",
    source: "manual",
  };
}

export function emptyPillar(): PillarDraft {
  return {
    _key: newKey(),
    name: "",
    description: "",
    ratioPercent: 0,
    objectiveMix: emptyObjectiveMix(),
  };
}
