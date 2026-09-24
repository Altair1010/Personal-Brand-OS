import { describe, expect, it } from "vitest";
import { goalSchema } from "@/lib/validators/goal";
import { contentRatioModule } from "@/lib/prompts/content-ratio";
import { kpisForObjective, objectiveByKey } from "@/lib/onboarding/marketing-library";

describe("onboarding objective/kpi/content ratio", () => {
  it("recognizes legacy branding and prioritizes matching KPIs", () => {
    expect(objectiveByKey("branding")?.label).toBe("Xây dựng thương hiệu");
    const kpis = kpisForObjective("branding");
    expect(kpis[0]?.objectives).toContain("branding");
  });

  it("keeps KPI unit separate from numeric target", () => {
    const parsed = goalSchema.parse({
      name: "Tăng nhận diện",
      goalType: "branding",
      kpi: [{ metric: "reach", target: "10000", unit: "người" }],
    });
    expect(parsed.kpi?.[0]).toEqual({ metric: "reach", target: "10000", unit: "người" });
  });

  it("rejects a manual content ratio whose total is not 100", () => {
    const parsed = goalSchema.safeParse({
      name: "Tăng nhận diện",
      goalType: "branding",
      contentRatio: { seo: 30, educate: 30, trust: 30 },
    });
    expect(parsed.success).toBe(false);
  });

  it("normalizes Agent content-ratio output to exactly 100", () => {
    const normalized = contentRatioModule.normalize!({
      contentRatio: { seo: 10, educate: 30, trust: 30, conversion: 5, story: 15, community: 20 },
      rationale: "Ưu tiên giáo dục và niềm tin.",
      assumptions: [],
    });
    expect(Object.values(normalized.contentRatio).reduce((sum, value) => sum + value, 0)).toBe(100);
  });
});
