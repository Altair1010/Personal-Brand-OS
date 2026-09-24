# Piltover Full Soft-Neumorphic UI Redesign — Acceptance

Date: 2026-09-23
Status: IMPLEMENTED / E2 VERIFIED
AMH run: AMH-20260923-PILTOVER-UI-SOFT-NEUMORPHIC
Timeout: 120 minutes

## Canonical visual reference
The user-provided image is the canonical visual source. Web searches using distinctive labels did not produce a trustworthy original/Pinterest source, so no author/source attribution is claimed.

## Extracted visual contract
- Base surface: #ECE4D6
- Raised surface: #EFE7D9
- Inset surface: #E9DFCF
- Pressed surface: #E4DAC9
- Primary teal: #0C4F54
- Ink: #252923
- Radius scale: 4 / 8 / 12 / 16 / 24px
- Spacing anchors: 8 / 16 / 24px
- Icon sizes: 16 / 20 / 24px
- Icon stroke: 2px
- Elevation: paired warm shadow + warm highlight
- Input wells: inset paired shadows
- Active/pressed controls: inset shadow, not motion
- Texture: subtle warm radial/linear surface variation

## Applied globally
- app background and texture
- side navigation and active states
- topbar and account switcher
- page headers and content shell
- cards and nested bordered panels
- primary/secondary/outline/ghost/destructive buttons
- text inputs and textareas
- native selects
- badges/chips
- dropdown menus
- tooltips
- searchable selects
- tables
- command palette
- agent dock/sidebar and messages
- settings subtabs
- strategy/studio/calendar/content objective tags
- performance charts and ratio bars
- semantic success/warning/error surfaces

## Preserved
- Routes and navigation structure
- Product content
- Data models
- Server actions/APIs
- Agent behavior
- Approval behavior
- Settings functionality
- .ENV vault behavior
- Provider/worker behavior

## Design artifacts
- docs/ui-soft-neumorphic-spec.json
- docs/ui-soft-neumorphic-reference.html

## Accessibility guardrail
The reference aesthetic uses low-contrast soft surfaces. Text contrast is not allowed to depend on shadow. Main ink/teal contrast is comfortably above AA; muted text was darkened slightly from the direct image-derived approximation so normal-size text clears the 4.5:1 target.

## Verification
- TypeScript: PASS
- Targeted regression: 13/13 PASS across 3 files
- Production Next.js build: PASS
- /settings?tab=system runtime HTTP: 200
- Piltover supervisor: ACTIVE
- OpenClaw worker: ACTIVE and polling/heartbeat 200
- Build temporarily disturbed .next dev artifacts; existing supervisor self-recovered worker and runtime returned to healthy 200 heartbeat/poll state.

## Research decision
ADOPT_CANDIDATE — the visual language is coherent and can be implemented with a single token/primitive source of truth. Exact original-source attribution remains UNKNOWN and is non-blocking because the supplied image itself is the authorized visual reference.
