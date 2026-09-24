import type { ProviderConnectionAdapter } from "../connection-service";

export type SearchConsolePerformanceRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export async function fetchSearchConsolePerformance(
  accessToken: string,
  input: {
    siteUrl: string;
    startDate: string;
    endDate: string;
    dimensions?: Array<"date" | "query" | "page" | "country" | "device" | "searchAppearance">;
    rowLimit?: number;
  },
) {
  const response = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(input.siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({
        startDate: input.startDate,
        endDate: input.endDate,
        dimensions: input.dimensions ?? ["date", "query", "page"],
        rowLimit: Math.max(1, Math.min(input.rowLimit ?? 25000, 25000)),
        dataState: "final",
      }),
      cache: "no-store",
    },
  );
  const result = await json<{ rows?: SearchConsolePerformanceRow[] }>(response);
  return result.rows ?? [];
}

async function json<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as T & { error?: string | { message?: string }; error_description?: string };
  if (!response.ok) {
    const message =
      typeof body.error === "object" ? body.error?.message : body.error_description || body.error;
    throw new Error(`GOOGLE_HTTP_${response.status}:${message || "Provider request failed"}`);
  }
  return body;
}

export const googleSearchConsoleAdapter: ProviderConnectionAdapter = {
  id: "GOOGLE_SEARCH_CONSOLE",
  label: "Google Search Console",
  category: "SEARCH",
  env: { clientId: "PILTOVER_GOOGLE_CLIENT_ID", clientSecret: "PILTOVER_GOOGLE_CLIENT_SECRET" },
  defaultScopes: ["openid", "email", "profile", "https://www.googleapis.com/auth/webmasters.readonly"],
  capabilities: ["search.console.read", "search.properties.discover", "search.performance.read"],
  buildAuthorizationUrl({ state, redirectUri, clientId, scopes }) {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scopes.join(" "));
    url.searchParams.set("state", state);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("prompt", "consent");
    return url.toString();
  },
  async exchangeCode({ code, redirectUri, clientId, clientSecret }) {
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });
    const result = await json<{ access_token: string; expires_in?: number; refresh_token?: string; scope?: string }>(
      await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
        cache: "no-store",
      }),
    );
    return {
      accessToken: result.access_token,
      refreshToken: result.refresh_token ?? null,
      expiresAt: result.expires_in ? new Date(Date.now() + result.expires_in * 1000) : null,
      scopes: result.scope?.split(/\s+/).filter(Boolean),
    };
  },
  async refreshToken({ refreshToken, clientId, clientSecret }) {
    const body = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    });
    const result = await json<{ access_token: string; expires_in?: number; scope?: string }>(
      await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
        cache: "no-store",
      }),
    );
    return {
      accessToken: result.access_token,
      refreshToken,
      expiresAt: result.expires_in ? new Date(Date.now() + result.expires_in * 1000) : null,
      scopes: result.scope?.split(/\s+/).filter(Boolean),
    };
  },
  async fetchIdentity(accessToken) {
    const result = await json<{ sub: string; name?: string; email?: string }>(
      await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      }),
    );
    return {
      externalAccountId: result.sub,
      externalAccountName: result.email || result.name || result.sub,
    };
  },
  async discoverResources(accessToken) {
    const result = await json<{ siteEntry?: Array<{ siteUrl: string; permissionLevel?: string }> }>(
      await fetch("https://www.googleapis.com/webmasters/v3/sites", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      }),
    );
    return (result.siteEntry ?? []).map((site) => ({
      resourceType: "SEARCH_CONSOLE_PROPERTY",
      externalId: site.siteUrl,
      name: site.siteUrl,
      capabilities: ["search.performance.read"],
      metadata: { permissionLevel: site.permissionLevel ?? "unknown" },
    }));
  },
  async verify(accessToken) {
    const identity = await this.fetchIdentity(accessToken);
    await this.discoverResources(accessToken);
    return { ok: true, identity };
  },
  async revoke(accessToken) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(accessToken)}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      cache: "no-store",
    });
  },
};
