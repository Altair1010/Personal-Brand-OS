import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import { createMigrationWorkspace, deployMigrations } from "./p2-test-db";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    const resolved = path.resolve(root);
    const tempRoot = path.resolve(process.env.TEMP ?? process.env.TMP ?? "");
    if (!resolved.startsWith(tempRoot + path.sep)) throw new Error("Unsafe test cleanup path.");
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});

async function withDatabase(run: (db: PrismaClient) => Promise<void>) {
  const workspace = createMigrationWorkspace();
  roots.push(workspace.root);
  deployMigrations(workspace.schemaPath, workspace.url);
  const db = new PrismaClient({ datasources: { db: { url: workspace.url } } });
  try {
    await run(db);
  } finally {
    await db.$disconnect();
  }
}

async function seedTenant(db: PrismaClient) {
  await db.organization.create({ data: { id: "org-a", name: "Org A" } });
  await db.workspace.create({
    data: { id: "workspace-a", organizationId: "org-a", name: "Workspace A" },
  });
  await db.brand.create({
    data: {
      id: "brand-a",
      organizationId: "org-a",
      workspaceId: "workspace-a",
      name: "Brand A",
    },
  });
}

describe("H1 paid-media engine", () => {
  it("deploys the Ads schema and persists campaign performance evidence", async () => {
    await withDatabase(async (db) => {
      await seedTenant(db);
      const campaign = await db.adCampaign.create({
        data: {
          id: "campaign-a",
          organizationId: "org-a",
          brandId: "brand-a",
          name: "H1 Campaign",
          objective: "leads",
          audience: { summary: "Warm audience" },
          budgetAmount: 1000000,
          status: "READY",
        },
      });

      await db.adMetricObservation.create({
        data: {
          campaignId: campaign.id,
          organizationId: "org-a",
          brandId: "brand-a",
          metricKey: "clicks",
          numericValue: 42,
          source: "MANUAL",
          provenance: { mode: "H1_INTERNAL_DEMO" },
        },
      });

      const loaded = await db.adCampaign.findUniqueOrThrow({
        where: { id: campaign.id },
        include: { metrics: true },
      });
      expect(loaded.deliveryMode).toBe("INTERNAL_DEMO");
      expect(loaded.metrics).toHaveLength(1);
      expect(loaded.metrics[0]?.numericValue).toBe(42);
      expect(
        await db.$queryRawUnsafe<Array<{ foreign_key_check: unknown }>>(
          "PRAGMA foreign_key_check",
        ),
      ).toEqual([]);
    });
  }, 30_000);

  it("rejects a campaign whose brand ancestry belongs to another organization", async () => {
    await withDatabase(async (db) => {
      await seedTenant(db);
      await db.organization.create({ data: { id: "org-b", name: "Org B" } });

      await expect(
        db.adCampaign.create({
          data: {
            id: "campaign-cross-tenant",
            organizationId: "org-b",
            brandId: "brand-a",
            name: "Invalid",
            objective: "leads",
          },
        }),
      ).rejects.toThrow();
    });
  }, 30_000);
});
