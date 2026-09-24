import { afterEach, describe, expect, it, vi } from "vitest";
import { createP3Fixture, type P3Fixture } from "./p3-test-db";
import { assertProviderTargetScope, getBrandIsolationSnapshot, validateTenantScope } from "../../lib/piltover/vnext/governance-service";
import { assertSafeBetaRecoveryEnvelope, exportBetaRecovery } from "../../lib/piltover/vnext/beta-recovery";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });
let fixture: P3Fixture | null = null;
afterEach(async () => { if (fixture) await fixture.database.dispose(); fixture = null; });

async function setup() {
  fixture = await createP3Fixture();
  const db = fixture.db;
  return db;
}

describe("H2.4 multi-brand governance", () => {
  it("rejects a brand outside the explicit tenant scope", async () => {
    const db = await setup();
    await expect(validateTenantScope(db, { organizationId: "org-a", workspaceId: "workspace-a", brandId: "brand-a1" })).resolves.toMatchObject({ id: "brand-a1" });
    await expect(validateTenantScope(db, { organizationId: "org-a", workspaceId: "wrong", brandId: "brand-a1" })).rejects.toThrow("BRAND_SCOPE_FORBIDDEN");
  });

  it("provider account/resource access cannot cross brand scope", async () => {
    const db = await setup();
    await db.providerConnection.create({ data: {
      id: "conn-a", organizationId: "org-a", workspaceId: "workspace-a", brandId: "brand-a1", provider: "META",
      externalAccountId: "acct-a", status: "CONNECTED", health: { status: "HEALTHY" },
    }});
    await db.providerResource.create({ data: {
      id: "res-a", connectionId: "conn-a", externalId: "page-a", resourceType: "PAGE", name: "Page A",
    }});
    await expect(assertProviderTargetScope(db, {
      organizationId: "org-a", workspaceId: "workspace-a", brandId: "brand-a1", connectionId: "conn-a", resourceId: "res-a",
    })).resolves.toMatchObject({ connection: { id: "conn-a" }, resource: { id: "res-a" } });
    await expect(assertProviderTargetScope(db, {
      organizationId: "org-a", workspaceId: "workspace-a", brandId: "brand-a2", connectionId: "conn-a", resourceId: "res-a",
    })).rejects.toThrow("PROVIDER_CONNECTION_SCOPE_FORBIDDEN");
  });

  it("isolation snapshot counts only the requested brand", async () => {
    const db = await setup();
    await db.evidence.createMany({ data: [
      { id: "ev-a", organizationId: "org-a", brandId: "brand-a1", sourceType: "TEST", content: {}, capturedAt: new Date() },
      { id: "ev-b", organizationId: "org-a", brandId: "brand-a2", sourceType: "TEST", content: {}, capturedAt: new Date() },
    ]});
    await db.recommendation.createMany({ data: [
      { id: "rec-a", organizationId: "org-a", brandId: "brand-a1", type: "TEST", title: "A", rationale: "A", evidenceRefs: [], status: "PROPOSED" },
      { id: "rec-b", organizationId: "org-a", brandId: "brand-a2", type: "TEST", title: "B", rationale: "B", evidenceRefs: [], status: "PROPOSED" },
    ]});
    const a = await getBrandIsolationSnapshot(db, { organizationId: "org-a", workspaceId: "workspace-a", brandId: "brand-a1" });
    expect(a.counts.evidence).toBe(1);
    expect(a.counts.recommendations).toBe(1);
  });

  it("beta recovery redacts provider secrets and marks historical jobs non-replayable", async () => {
    const db = await setup();
    await db.providerConnection.create({ data: {
      id: "conn-a", organizationId: "org-a", workspaceId: "workspace-a", brandId: "brand-a1", provider: "META",
      externalAccountId: "acct-a", status: "CONNECTED", health: { status: "HEALTHY" }, credentialCiphertext: "secret", refreshTokenCiphertext: "refresh",
    }});
    const envelope = await exportBetaRecovery(db, { organizationId: "org-a", workspaceId: "workspace-a", brandId: "brand-a1" });
    expect(envelope.safety).toMatchObject({ rawProviderSecretsIncluded: false, historicalExternalJobsReplayable: false });
    expect(JSON.stringify(envelope)).not.toContain('"credentialCiphertext":"secret"');
    expect(JSON.stringify(envelope)).not.toContain('"refreshCiphertext":"refresh"');
    expect(() => assertSafeBetaRecoveryEnvelope(envelope)).not.toThrow();
  });
});

