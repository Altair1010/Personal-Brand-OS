import { z } from "zod";

// Goal = the active objective the strategy is built for. name + goalType required (a goal
// must be identifiable); the rest optional. kpi is a list of measurable targets; contentRatio
// is a free-form objective→weight map (pillar ratio normalize-to-100 happens in M5, not here).

const trimmedString = z.string().trim().max(5000);

export const kpiItemSchema = z.object({
  metric: z.string().trim().min(1).max(120),
  target: z.string().trim().max(120).optional(),
});

export const goalSchema = z.object({
  name: z.string().trim().min(1, "Tên mục tiêu bắt buộc").max(200),
  goalType: z.string().trim().min(1, "Loại mục tiêu bắt buộc").max(120),
  timeRangeStart: z.coerce.date().optional(),
  timeRangeEnd: z.coerce.date().optional(),
  targetAudience: trimmedString.optional(),
  mainOffer: trimmedString.optional(),
  mainMessage: trimmedString.optional(),
  kpi: z.array(kpiItemSchema).max(20).optional(),
  contentRatio: z.record(z.string(), z.number().min(0).max(100)).optional(),
  risk: trimmedString.optional(),
  successDefinition: trimmedString.optional(),
});

export type GoalInput = z.infer<typeof goalSchema>;
export type KpiItem = z.infer<typeof kpiItemSchema>;
