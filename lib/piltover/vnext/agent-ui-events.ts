import { z } from "zod";

const base = z.object({
  eventId: z.string().min(1),
  threadId: z.string().min(1),
  runId: z.string().nullable().optional(),
  timestamp: z.string().min(1),
});

export const AgentUiEventSchema = z.discriminatedUnion("type", [
  base.extend({ type: z.literal("RUN_STARTED"), payload: z.record(z.string(), z.unknown()).optional() }),
  base.extend({ type: z.literal("RUN_FINISHED"), payload: z.record(z.string(), z.unknown()).optional() }),
  base.extend({ type: z.literal("TEXT_MESSAGE_START"), payload: z.record(z.string(), z.unknown()).optional() }),
  base.extend({ type: z.literal("TEXT_MESSAGE_CONTENT"), payload: z.object({ text: z.string() }) }),
  base.extend({ type: z.literal("TEXT_MESSAGE_END"), payload: z.record(z.string(), z.unknown()).optional() }),
  base.extend({ type: z.literal("TOOL_CALL_START"), payload: z.record(z.string(), z.unknown()) }),
  base.extend({ type: z.literal("TOOL_CALL_ARGS"), payload: z.record(z.string(), z.unknown()) }),
  base.extend({ type: z.literal("TOOL_CALL_RESULT"), payload: z.record(z.string(), z.unknown()) }),
  base.extend({ type: z.literal("STATE_SNAPSHOT"), payload: z.record(z.string(), z.unknown()) }),
  base.extend({ type: z.literal("STATE_DELTA"), payload: z.record(z.string(), z.unknown()) }),
  base.extend({ type: z.literal("ACTIVITY"), payload: z.object({ label: z.string(), detail: z.string().optional() }) }),
  base.extend({ type: z.literal("APPROVAL_REQUIRED"), payload: z.record(z.string(), z.unknown()) }),
  base.extend({ type: z.literal("ERROR"), payload: z.object({ code: z.string(), message: z.string() }) }),
]);

export type AgentUiEvent = z.infer<typeof AgentUiEventSchema>;

export const AGENT_UI_EVENT_TYPES = [
  "RUN_STARTED", "RUN_FINISHED",
  "TEXT_MESSAGE_START", "TEXT_MESSAGE_CONTENT", "TEXT_MESSAGE_END",
  "TOOL_CALL_START", "TOOL_CALL_ARGS", "TOOL_CALL_RESULT",
  "STATE_SNAPSHOT", "STATE_DELTA", "ACTIVITY", "APPROVAL_REQUIRED", "ERROR",
] as const;
