# H1.1 Result

Status: DONE

## Product delta
- Added tenant-aware `MarketingCampaign` as the internal campaign spine.
- Added explicit `ContentDelivery` state so approval is no longer equivalent to publication.
- Added `MetaAdsCampaign` as the H1 paid-media projection.
- Added `MetaAdsMetricSnapshot` with evidence payload for paid performance.
- Added unified Organic + Paid performance evidence retrieval.
- Added guarded delivery and Meta Ads state transitions.
- Added tenant propagation into new strategy/draft/post writes used by the H1 path.

## Meta Ads H1 projection
`MarketingCampaign → MetaAdsCampaign → targeting/budget + creativePost → MetaAdsMetricSnapshot → unified performance evidence`.

This is intentionally provider-ready, not provider-connected. `EXTERNAL_NOT_CONNECTED` is an explicit state; no live Meta action is claimed.

## Local migration
Migration `20260920130000_add_h1_marketing_spine` was applied successfully to local `prisma/dev.db`.
A pre-migration backup was captured in the AMH evidence directory.
Existing row counts for UserProfile, Organization, Workspace, Brand, Strategy, Post and MetricSnapshot were unchanged.
Existing local-only `AdCampaign` and `AdMetricObservation` tables were preserved and not adopted as H1 canonical schema.

## Verification
- Prisma schema validate: PASS.
- Fresh migration chain exercised by H1 test fixture: PASS.
- H1 product-spine test: PASS — 2/2.
- Architecture boundary test: PASS — 6/6.
- TypeScript delta: no new diagnostics; only the two known historical TS2352 diagnostics remain in `tests/ai/adapter-db-key.test.ts`.
- Production build: BLOCKED_ENV_RESOURCE — Next.js build worker exited with code 134 from V8 heap exhaustion; retry with `NODE_OPTIONS=--max-old-space-size=4096` failed the same way. No build PASS was inferred.
- Combined P2/H1 verification attempt stalled in the known Windows/Prisma contention pattern and was terminated; no PASS was inferred.
