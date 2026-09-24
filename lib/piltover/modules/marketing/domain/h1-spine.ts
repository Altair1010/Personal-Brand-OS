export const MARKETING_CHANNEL_MODES = ["ORGANIC", "PAID", "MIXED"] as const;
export type MarketingChannelMode = (typeof MARKETING_CHANNEL_MODES)[number];

export const MARKETING_CAMPAIGN_STATES = [
  "DRAFT",
  "PLANNING",
  "READY",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
] as const;
export type MarketingCampaignState = (typeof MARKETING_CAMPAIGN_STATES)[number];

export const MARKETING_CAMPAIGN_TRANSITIONS: Record<
  MarketingCampaignState,
  readonly MarketingCampaignState[]
> = {
  DRAFT: ["PLANNING", "ARCHIVED"],
  PLANNING: ["READY", "DRAFT", "ARCHIVED"],
  READY: ["ACTIVE", "PLANNING", "ARCHIVED"],
  ACTIVE: ["PAUSED", "COMPLETED"],
  PAUSED: ["ACTIVE", "COMPLETED", "ARCHIVED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function assertMarketingCampaignTransition(
  current: MarketingCampaignState,
  next: MarketingCampaignState,
): void {
  if (!MARKETING_CAMPAIGN_TRANSITIONS[current].includes(next)) {
    throw new Error(`MARKETING_CAMPAIGN_TRANSITION_INVALID:${current}->${next}`);
  }
}

export const DELIVERY_STATES = [
  "APPROVED",
  "SCHEDULED",
  "EXTERNAL_NOT_CONNECTED",
  "PUBLISHED",
  "FAILED",
] as const;
export type DeliveryState = (typeof DELIVERY_STATES)[number];

export const META_ADS_STATES = [
  "DRAFT",
  "READY",
  "EXTERNAL_NOT_CONNECTED",
  "SYNCED",
  "PAUSED",
  "COMPLETED",
] as const;
export type MetaAdsState = (typeof META_ADS_STATES)[number];

const DELIVERY_TRANSITIONS: Record<DeliveryState, readonly DeliveryState[]> = {
  APPROVED: ["SCHEDULED", "EXTERNAL_NOT_CONNECTED", "FAILED"],
  SCHEDULED: ["EXTERNAL_NOT_CONNECTED", "PUBLISHED", "FAILED"],
  EXTERNAL_NOT_CONNECTED: ["SCHEDULED", "FAILED"],
  PUBLISHED: [],
  FAILED: ["SCHEDULED", "EXTERNAL_NOT_CONNECTED"],
};

const META_ADS_TRANSITIONS: Record<MetaAdsState, readonly MetaAdsState[]> = {
  DRAFT: ["READY", "EXTERNAL_NOT_CONNECTED"],
  READY: ["EXTERNAL_NOT_CONNECTED", "SYNCED"],
  EXTERNAL_NOT_CONNECTED: ["READY"],
  SYNCED: ["PAUSED", "COMPLETED"],
  PAUSED: ["SYNCED", "COMPLETED"],
  COMPLETED: [],
};

export function assertDeliveryTransition(
  current: DeliveryState,
  next: DeliveryState,
): void {
  if (!DELIVERY_TRANSITIONS[current].includes(next)) {
    throw new Error(`DELIVERY_TRANSITION_INVALID:${current}->${next}`);
  }
}

export function assertMetaAdsTransition(
  current: MetaAdsState,
  next: MetaAdsState,
): void {
  if (!META_ADS_TRANSITIONS[current].includes(next)) {
    throw new Error(`META_ADS_TRANSITION_INVALID:${current}->${next}`);
  }
}

export type H1PerformanceEvidence = {
  channel: "ORGANIC" | "PAID";
  refId: string;
  capturedAt: Date;
  source: string;
  metrics: Record<string, number | null>;
  evidence: unknown;
};
