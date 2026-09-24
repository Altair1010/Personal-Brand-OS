import type { ProviderConnectionAdapter, ProviderResourceInput } from "../connection-service";

const GRAPH_VERSION = process.env.PILTOVER_META_GRAPH_VERSION || "v23.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

async function json<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as T & { error?: { message?: string; code?: number } };
  if (!response.ok || body?.error) {
    const code = body?.error?.code ? `META_${body.error.code}` : `META_HTTP_${response.status}`;
    throw new Error(`${code}:${body?.error?.message || "Provider request failed"}`);
  }
  return body;
}

export const metaProviderAdapter: ProviderConnectionAdapter = {
  id: "META",
  label: "Meta · Facebook / Instagram",
  category: "SOCIAL",
  env: { clientId: "PILTOVER_META_APP_ID", clientSecret: "PILTOVER_META_APP_SECRET" },
  defaultScopes: [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    "instagram_basic",
    "instagram_content_publish",
  ],
  capabilities: [
    "social.pages.discover",
    "social.facebook.publish",
    "social.facebook.analytics",
    "social.instagram.discover",
    "social.instagram.publish",
  ],
  buildAuthorizationUrl({ state, redirectUri, clientId, scopes }) {
    const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scopes.join(","));
    return url.toString();
  },
  async exchangeCode({ code, redirectUri, clientId, clientSecret }) {
    const url = new URL(`${GRAPH}/oauth/access_token`);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("client_secret", clientSecret);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("code", code);
    const result = await json<{ access_token: string; token_type?: string; expires_in?: number }>(
      await fetch(url, { cache: "no-store" }),
    );
    if (!result.access_token) throw new Error("META_ACCESS_TOKEN_MISSING");
    return {
      accessToken: result.access_token,
      expiresAt: result.expires_in ? new Date(Date.now() + result.expires_in * 1000) : null,
    };
  },
  async fetchIdentity(accessToken) {
    const url = new URL(`${GRAPH}/me`);
    url.searchParams.set("fields", "id,name");
    url.searchParams.set("access_token", accessToken);
    const result = await json<{ id: string; name: string }>(await fetch(url, { cache: "no-store" }));
    return { externalAccountId: result.id, externalAccountName: result.name || result.id };
  },
  async discoverResources(accessToken) {
    const url = new URL(`${GRAPH}/me/accounts`);
    url.searchParams.set("fields", "id,name,access_token,tasks,instagram_business_account{id,username,name}");
    url.searchParams.set("limit", "100");
    url.searchParams.set("access_token", accessToken);
    const result = await json<{
      data?: Array<{
        id: string;
        name?: string;
        access_token?: string;
        tasks?: string[];
        instagram_business_account?: { id: string; username?: string; name?: string };
      }>;
    }>(await fetch(url, { cache: "no-store" }));

    const resources: ProviderResourceInput[] = [];
    for (const page of result.data ?? []) {
      resources.push({
        resourceType: "FACEBOOK_PAGE",
        externalId: page.id,
        name: page.name || page.id,
        credential: page.access_token || null,
        capabilities: ["social.facebook.publish", "social.facebook.analytics"],
        metadata: { tasks: page.tasks ?? [] },
      });
      if (page.instagram_business_account?.id) {
        resources.push({
          resourceType: "INSTAGRAM_ACCOUNT",
          externalId: page.instagram_business_account.id,
          name:
            page.instagram_business_account.username ||
            page.instagram_business_account.name ||
            page.instagram_business_account.id,
          credential: page.access_token || null,
          capabilities: ["social.instagram.publish", "social.instagram.analytics"],
          metadata: { parentFacebookPageId: page.id },
        });
      }
    }
    return resources;
  },
  async verify(accessToken) {
    await this.fetchIdentity(accessToken);
    return { ok: true };
  },
  async revoke(accessToken) {
    const url = new URL(`${GRAPH}/me/permissions`);
    url.searchParams.set("access_token", accessToken);
    await fetch(url, { method: "DELETE", cache: "no-store" });
  },
};
