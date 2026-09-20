# H1.3 Agent Runtime + Intelligence Loop — Corrected Work Order

Work Order: PIL-WO-20260920-012-h1-intelligence-loop
Method: AMH v0.3 Partial + vertical product outcome philosophy

## Owner correction
All AI/bot analysis and automation in Piltover is an Agent capability. Product-domain code must not use direct model-provider APIs as the canonical execution path.

Allowed execution routes:
1. OAuth connector.
2. OpenClaw agent controller/runtime.

OpenClaw may create/control agents. Termius and 9router are supporting connectivity/routing layers for OpenClaw; they are not peer AI providers or independent Agent execution authorities.

## Objective
Route Organic + Paid/Meta marketing intelligence through the Piltover Agent Control Plane, receive structured result artifacts, validate evidence provenance, and feed accepted insight into Review/Revision.

## DONE target
- Marketing intelligence dispatches through AgentExecutionGateway + P3 queue.
- OAuth and OpenClaw are explicit route contracts.
- OpenClaw support metadata nests Termius/9router under OpenClaw.
- No direct model call exists in the H1.3 product path.
- Agent result artifact is schema validated and evidence-ref validated before persistence.
- Result feeds existing PerformanceInsight → Review → Revision loop.
- Runtime UI shows Agent connector state truthfully.
- Live OpenClaw/OAuth worker execution is verified before H1.3 is promoted to VERIFIED.

## Non-goals
Do not build full OpenClaw provisioning, Termius automation, 9router administration, autonomous budget mutation, or H1.4 closure in this correction.
