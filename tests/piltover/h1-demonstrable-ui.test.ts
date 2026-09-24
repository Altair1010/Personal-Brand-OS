import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");
const read = (relative: string) =>
  fs.readFileSync(path.join(root, relative), "utf8");

describe("H1.2 demonstrable UI contract", () => {
  it("exposes the campaign route in primary navigation", () => {
    const sidebar = read("components/layout/Sidebar.tsx");
    expect(sidebar).toContain('href: "/campaigns"');
    expect(sidebar).toContain('label: "Campaigns"');
  });

  it("keeps the H1 golden journey traversable through navigation and Command Center", () => {
    const sidebar = read("components/layout/Sidebar.tsx");
    const page = read("app/(dashboard)/page.tsx");
    for (const route of ["/onboarding", "/strategy", "/studio", "/campaigns", "/performance", "/review"]) {
      expect(sidebar).toContain(`href: "${route}"`);
    }
    expect(page).toContain('title="Command Center"');
    expect(page).toContain("Pending approvals");
    expect(page).toContain("Campaign pulse");
    expect(page).toContain("Recent intelligence");
  });
  it("makes organic scheduling and Meta Ads explicit UI actions", () => {
    const workspace = read("components/marketing/CampaignWorkspace.tsx");
    expect(workspace).toContain("Lên lịch Organic");
    expect(workspace).toContain("Tạo Meta Ads seam");
    expect(workspace).toContain("EXTERNAL_NOT_CONNECTED");
    expect(workspace).toContain("Lưu Paid evidence");
  });

  it("surfaces paid evidence in the performance experience", () => {
    const page = read("app/(dashboard)/performance/page.tsx");
    const table = read("components/performance/PaidPerformanceTable.tsx");
    expect(page).toContain("PaidPerformanceTable");
    expect(table).toContain("Meta Ads performance");
    expect(table).toContain("Conversions");
  });

  it("does not claim live Meta execution in the demonstrable UI", () => {
    const workspace = read("components/marketing/CampaignWorkspace.tsx");
    expect(workspace).toContain("Chưa kết nối Meta API");
    expect(workspace).not.toContain("Đang chạy trên Meta");
  });
});
