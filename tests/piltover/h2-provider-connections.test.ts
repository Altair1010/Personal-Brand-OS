import { afterEach, describe, expect, it, vi } from "vitest";
import { createP3Fixture, type P3Fixture } from "./p3-test-db";
import {
  beginProviderOAuth,
  completeProviderOAuth,
  getProviderConnections,
  redactProviderError,
  registerProviderConnectionAdapter,
  revokeProviderConnection,
  verifyProviderConnection,
  type ProviderConnectionAdapter,
} from "../../lib/piltover/providers/connection-service";
import { metaProviderAdapter } from "../../lib/piltover/providers/adapters/meta";
import { linkedinProviderAdapter } from "../../lib/piltover/providers/adapters/linkedin";
import { googleSearchConsoleAdapter } from "../../lib/piltover/providers/adapters/google-search-console";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

let fixture: P3Fixture | null = null;
const oldEnv = { ...process.env };

afterEach(async () => {
  if (fixture) await fixture.database.dispose();
  fixture = null;
  process.env.PILTOVER_LINKEDIN_CLIENT_ID = oldEnv.PILTOVER_LINKEDIN_CLIENT_ID;
  process.env.PILTOVER_LINKEDIN_CLIENT_SECRET = oldEnv.PILTOVER_LINKEDIN_CLIENT_SECRET;
});

describe("H2.1 provider connection fabric", () => {
  it("keeps Meta and LinkedIn behind the same provider contract", () => {
    for (const adapter of [metaProviderAdapter, linkedinProviderAdapter]) {
      expect(adapter.category).toBe("SOCIAL");
      expect(typeof adapter.buildAuthorizationUrl).toBe("function");
      expect(typeof adapter.exchangeCode).toBe("function");
      expect(typeof adapter.fetchIdentity).toBe("function");
      expect(typeof adapter.discoverResources).toBe("function");
      expect(typeof adapter.verify).toBe("function");
      expect(adapter.capabilities.length).toBeGreaterThan(0);
    }
    const metaUrl = new URL(metaProviderAdapter.buildAuthorizationUrl({
      state: "state-1",
      redirectUri: "http://127.0.0.1:3015/api/providers/meta/callback",
      clientId: "meta-client",
      scopes: metaProviderAdapter.defaultScopes,
    }));
    const linkedinUrl = new URL(linkedinProviderAdapter.buildAuthorizationUrl({
      state: "state-2",
      redirectUri: "http://127.0.0.1:3015/api/providers/linkedin/callback",
      clientId: "linkedin-client",
      scopes: linkedinProviderAdapter.defaultScopes,
    }));
    expect(metaUrl.searchParams.get("state")).toBe("state-1");
    expect(linkedinUrl.searchParams.get("state")).toBe("state-2");
    expect(linkedinUrl.origin).toBe("https://www.linkedin.com");
  });

  it("uses the Search Console read-only OAuth scope and offline consent", () => {
    const url = new URL(googleSearchConsoleAdapter.buildAuthorizationUrl({
      state: "g-state",
      redirectUri: "http://127.0.0.1:3015/api/providers/google-search-console/callback",
      clientId: "google-client",
      scopes: googleSearchConsoleAdapter.defaultScopes,
    }));
    expect(url.searchParams.get("scope")).toContain("https://www.googleapis.com/auth/webmasters.readonly");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("state")).toBe("g-state");
  });

  it("redacts credential material from provider errors", () => {
    const redacted = redactProviderError(
      "401 access_token=secret-token client_secret=my-secret Authorization: Bearer abc.def.ghi refresh_token=refresh-secret",
    );
    expect(redacted).not.toContain("secret-token");
    expect(redacted).not.toContain("my-secret");
    expect(redacted).not.toContain("abc.def.ghi");
    expect(redacted).not.toContain("refresh-secret");
    expect(redacted).toContain("[REDACTED]");
  });

  it("persists OAuth state, encrypted credentials, resources and revoke semantics", async () => {
    fixture = await createP3Fixture();
    const { db } = fixture;
    await db.userProfile.create({
      data: { id: "local", name: "Local", userIdentityId: "identity-owner" },
    });
    await db.brandDNA.create({
      data: {
        id: "dna-local",
        userId: "local",
        organizationId: "org-a",
        brandId: "brand-a1",
        companyName: "Brand A1",
      },
    });
    process.env.PILTOVER_LINKEDIN_CLIENT_ID = "test-client";
    process.env.PILTOVER_LINKEDIN_CLIENT_SECRET = "test-secret";

    let verifyCalls = 0;
    const fake: ProviderConnectionAdapter = {
      id: "LINKEDIN",
      label: "LinkedIn Test",
      category: "SOCIAL",
      env: { clientId: "PILTOVER_LINKEDIN_CLIENT_ID", clientSecret: "PILTOVER_LINKEDIN_CLIENT_SECRET" },
      defaultScopes: ["openid", "profile", "w_member_social"],
      capabilities: ["social.linkedin.profile", "social.linkedin.publish.member"],
      buildAuthorizationUrl({ state, redirectUri, clientId }) {
        const url = new URL("https://example.invalid/oauth");
        url.searchParams.set("state", state);
        url.searchParams.set("redirect_uri", redirectUri);
        url.searchParams.set("client_id", clientId);
        return url.toString();
      },
      async exchangeCode() {
        return { accessToken: "live-access-token", refreshToken: "live-refresh-token", expiresAt: new Date(Date.now() + 3600_000) };
      },
      async fetchIdentity() {
        return { externalAccountId: "member-123", externalAccountName: "Beta Operator" };
      },
      async discoverResources() {
        return [{
          resourceType: "LINKEDIN_MEMBER",
          externalId: "member-123",
          name: "Beta Operator",
          capabilities: ["social.linkedin.publish.member"],
        }];
      },
      async verify() {
        verifyCalls += 1;
        return { ok: true };
      },
    };
    registerProviderConnectionAdapter(fake);

    const started = await beginProviderOAuth(db, "LINKEDIN");
    const attempt = await db.providerOAuthAttempt.findUnique({ where: { state: started.state } });
    expect(attempt?.status).toBe("PENDING");

    const connected = await completeProviderOAuth(db, {
      provider: "LINKEDIN",
      state: started.state,
      code: "auth-code",
    });
    expect(connected.status).toBe("CONNECTED");
    expect(connected.credentialCiphertext).not.toBe("live-access-token");
    expect(connected.refreshTokenCiphertext).not.toBe("live-refresh-token");

    const rows = await getProviderConnections(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      provider: "LINKEDIN",
      status: "CONNECTED",
      externalAccountId: "member-123",
    });
    expect(rows[0].resources).toHaveLength(1);
    expect(verifyCalls).toBeGreaterThan(0);

    await revokeProviderConnection(db, connected.id);
    await expect(verifyProviderConnection(db, connected.id)).rejects.toThrow("PROVIDER_CONNECTION_REVOKED");
    const revoked = await db.providerConnection.findUnique({ where: { id: connected.id } });
    expect(revoked?.status).toBe("REVOKED");
    expect(revoked?.credentialCiphertext).toBeNull();
    expect(revoked?.refreshTokenCiphertext).toBeNull();
  });
});
