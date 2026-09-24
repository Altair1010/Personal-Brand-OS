import type { ProviderConnectionAdapter } from "../connection-service";

async function json<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as T & { message?: string; error_description?: string };
  if (!response.ok) {
    throw new Error(`LINKEDIN_HTTP_${response.status}:${body.error_description || body.message || "Provider request failed"}`);
  }
  return body;
}

export const linkedinProviderAdapter: ProviderConnectionAdapter = {
  id: "LINKEDIN",
  label: "LinkedIn",
  category: "SOCIAL",
  env: { clientId: "PILTOVER_LINKEDIN_CLIENT_ID", clientSecret: "PILTOVER_LINKEDIN_CLIENT_SECRET" },
  defaultScopes: (process.env.PILTOVER_LINKEDIN_SCOPES || "openid profile email w_member_social")
    .split(/\s+/)
    .filter(Boolean),
  capabilities: ["social.linkedin.profile", "social.linkedin.publish.member"],
  buildAuthorizationUrl({ state, redirectUri, clientId, scopes }) {
    const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", scopes.join(" "));
    return url.toString();
  },
  async exchangeCode({ code, redirectUri, clientId, clientSecret }) {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });
    const result = await json<{ access_token: string; expires_in?: number; refresh_token?: string; refresh_token_expires_in?: number; scope?: string }>(
      await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
        cache: "no-store",
      }),
    );
    if (!result.access_token) throw new Error("LINKEDIN_ACCESS_TOKEN_MISSING");
    return {
      accessToken: result.access_token,
      refreshToken: result.refresh_token ?? null,
      expiresAt: result.expires_in ? new Date(Date.now() + result.expires_in * 1000) : null,
      scopes: result.scope?.split(/\s+/).filter(Boolean),
    };
  },
  async refreshToken({ refreshToken, clientId, clientSecret }) {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });
    const result = await json<{ access_token: string; expires_in?: number; refresh_token?: string; scope?: string }>(
      await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
        cache: "no-store",
      }),
    );
    return {
      accessToken: result.access_token,
      refreshToken: result.refresh_token ?? refreshToken,
      expiresAt: result.expires_in ? new Date(Date.now() + result.expires_in * 1000) : null,
      scopes: result.scope?.split(/\s+/).filter(Boolean),
    };
  },
  async fetchIdentity(accessToken) {
    const result = await json<{ sub: string; name?: string; given_name?: string; family_name?: string }>(
      await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      }),
    );
    const name = result.name || [result.given_name, result.family_name].filter(Boolean).join(" ") || result.sub;
    return { externalAccountId: result.sub, externalAccountName: name };
  },
  async discoverResources(accessToken) {
    const identity = await this.fetchIdentity(accessToken);
    return [{
      resourceType: "LINKEDIN_MEMBER",
      externalId: identity.externalAccountId,
      name: identity.externalAccountName,
      capabilities: ["social.linkedin.publish.member"],
      metadata: {},
    }];
  },
  async verify(accessToken) {
    const identity = await this.fetchIdentity(accessToken);
    return { ok: true, identity };
  },
};
