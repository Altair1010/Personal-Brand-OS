import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { encryptString, decryptString } from "@/lib/ai/keystore";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";

const json = (value: unknown) => value as Prisma.InputJsonValue;

export type ProviderKind = "META" | "LINKEDIN" | "GOOGLE_SEARCH_CONSOLE";
export type ProviderConnectionState =
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "DEGRADED"
  | "AUTH_EXPIRED"
  | "REAUTH_REQUIRED"
  | "REVOKED"
  | "ERROR";

export type ProviderResourceInput = {
  resourceType: string;
  externalId: string;
  name: string;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
  credential?: string | null;
};

export type OAuthTokenResult = {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  scopes?: string[];
};

export type ProviderIdentity = {
  externalAccountId: string;
  externalAccountName: string;
};

export interface ProviderConnectionAdapter {
  id: ProviderKind;
  label: string;
  category: "SOCIAL" | "SEARCH";
  env: { clientId: string; clientSecret: string };
  defaultScopes: string[];
  capabilities: string[];
  buildAuthorizationUrl(input: {
    state: string;
    redirectUri: string;
    clientId: string;
    scopes: string[];
  }): string;
  exchangeCode(input: {
    code: string;
    redirectUri: string;
    clientId: string;
    clientSecret: string;
  }): Promise<OAuthTokenResult>;
  refreshToken?(input: {
    refreshToken: string;
    clientId: string;
    clientSecret: string;
  }): Promise<OAuthTokenResult>;
  fetchIdentity(accessToken: string): Promise<ProviderIdentity>;
  discoverResources(accessToken: string): Promise<ProviderResourceInput[]>;
  verify(accessToken: string): Promise<{ ok: true; identity?: ProviderIdentity }>;
  revoke?(accessToken: string): Promise<void>;
}

const adapters = new Map<ProviderKind, ProviderConnectionAdapter>();

export function registerProviderConnectionAdapter(adapter: ProviderConnectionAdapter) {
  adapters.set(adapter.id, adapter);
}

export function getProviderConnectionAdapter(provider: string) {
  return adapters.get(provider as ProviderKind) ?? null;
}

export function listProviderConnectionAdapters() {
  return Array.from(adapters.values()).map((adapter) => ({
    id: adapter.id,
    label: adapter.label,
    category: adapter.category,
    capabilities: adapter.capabilities,
    configured: Boolean(process.env[adapter.env.clientId] && process.env[adapter.env.clientSecret]),
    supportsRefresh: typeof adapter.refreshToken === "function",
    supportsRevoke: typeof adapter.revoke === "function",
  }));
}

export function providerPublicBaseUrl() {
  return (process.env.PILTOVER_PUBLIC_BASE_URL || "http://127.0.0.1:3015").replace(/\/$/, "");
}

export function providerRedirectUri(provider: ProviderKind) {
  return `${providerPublicBaseUrl()}/api/providers/${provider.toLowerCase()}/callback`;
}

export function redactProviderError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? "PROVIDER_ERROR");
  return raw
    .replace(/access_token=[^&\s]+/gi, "access_token=[REDACTED]")
    .replace(/refresh_token=[^&\s]+/gi, "refresh_token=[REDACTED]")
    .replace(/client_secret=[^&\s]+/gi, "client_secret=[REDACTED]")
    .replace(/(^|[?&])code=[^&\s]+/gi, "$1code=[REDACTED]")
    .replace(/"(access_token|refresh_token|client_secret|code)"\s*:\s*"[^"]+"/gi, '"$1":"[REDACTED]"')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .slice(0, 1200);
}

async function auditProviderConnection(
  db: PrismaClient,
  input: {
    organizationId: string;
    action: string;
    targetType?: string;
    targetId: string;
    correlationId: string;
    metadata?: unknown;
  },
) {
  await db.auditEntry.create({
    data: {
      id: randomUUID(),
      organizationId: input.organizationId,
      actorType: "HUMAN",
      actorId: "local",
      action: input.action,
      targetType: input.targetType ?? "PROVIDER_CONNECTION",
      targetId: input.targetId,
      correlationId: input.correlationId,
      metadata: input.metadata === undefined ? undefined : json(input.metadata),
      occurredAt: new Date(),
    },
  });
}

export async function beginProviderOAuth(db: PrismaClient, provider: ProviderKind) {
  const adapter = getProviderConnectionAdapter(provider);
  if (!adapter) throw new Error("PROVIDER_NOT_SUPPORTED");
  const clientId = process.env[adapter.env.clientId];
  const clientSecret = process.env[adapter.env.clientSecret];
  if (!clientId || !clientSecret) throw new Error(`PROVIDER_NOT_CONFIGURED:${provider}`);

  const tenant = await resolveLocalTenant(db);
  const state = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  const redirectUri = providerRedirectUri(provider);
  const expiresAt = new Date(Date.now() + 10 * 60_000);

  const attempt = await db.providerOAuthAttempt.create({
    data: {
      id: randomUUID(),
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      brandId: tenant.brandId,
      provider,
      state,
      redirectUri,
      status: "PENDING",
      expiresAt,
    },
  });

  await auditProviderConnection(db, {
    organizationId: tenant.organizationId,
    action: "PROVIDER_OAUTH_STARTED",
    targetType: "PROVIDER_OAUTH_ATTEMPT",
    targetId: attempt.id,
    correlationId: attempt.id,
    metadata: {
      provider,
      workspaceId: tenant.workspaceId,
      brandId: tenant.brandId,
      redirectUri,
      expiresAt: expiresAt.toISOString(),
      scopes: adapter.defaultScopes,
    },
  });

  const url = adapter.buildAuthorizationUrl({
    state,
    redirectUri,
    clientId,
    scopes: adapter.defaultScopes,
  });
  return { url, state, expiresAt };
}

export async function failProviderOAuthAttempt(
  db: PrismaClient,
  input: { provider: ProviderKind; state: string; error: unknown },
) {
  const attempt = await db.providerOAuthAttempt.findUnique({ where: { state: input.state } });
  if (!attempt || attempt.provider !== input.provider) return null;
  if (attempt.status !== "PENDING") return attempt;

  const message = redactProviderError(input.error);
  const updated = await db.providerOAuthAttempt.update({
    where: { id: attempt.id },
    data: {
      status: attempt.expiresAt <= new Date() ? "EXPIRED" : "FAILED",
      completedAt: new Date(),
      errorCode: attempt.expiresAt <= new Date() ? "STATE_EXPIRED" : "PROVIDER_REJECTED",
      errorMessage: message,
    },
  });
  await auditProviderConnection(db, {
    organizationId: attempt.organizationId,
    action: "PROVIDER_OAUTH_FAILED",
    targetType: "PROVIDER_OAUTH_ATTEMPT",
    targetId: attempt.id,
    correlationId: attempt.id,
    metadata: {
      provider: attempt.provider,
      workspaceId: attempt.workspaceId,
      brandId: attempt.brandId,
      error: message,
    },
  });
  return updated;
}

export async function completeProviderOAuth(
  db: PrismaClient,
  input: { provider: ProviderKind; state: string; code: string },
) {
  const adapter = getProviderConnectionAdapter(input.provider);
  if (!adapter) throw new Error("PROVIDER_NOT_SUPPORTED");
  const attempt = await db.providerOAuthAttempt.findUnique({ where: { state: input.state } });
  if (!attempt || attempt.provider !== input.provider) throw new Error("OAUTH_STATE_INVALID");
  if (attempt.status !== "PENDING") throw new Error("OAUTH_STATE_ALREADY_USED");
  if (attempt.expiresAt <= new Date()) {
    await db.providerOAuthAttempt.update({
      where: { id: attempt.id },
      data: { status: "EXPIRED", errorCode: "STATE_EXPIRED", completedAt: new Date() },
    });
    throw new Error("OAUTH_STATE_EXPIRED");
  }

  const clientId = process.env[adapter.env.clientId];
  const clientSecret = process.env[adapter.env.clientSecret];
  if (!clientId || !clientSecret) throw new Error(`PROVIDER_NOT_CONFIGURED:${input.provider}`);

  try {
    const token = await adapter.exchangeCode({
      code: input.code,
      redirectUri: attempt.redirectUri,
      clientId,
      clientSecret,
    });
    const identity = await adapter.fetchIdentity(token.accessToken);
    const resources = await adapter.discoverResources(token.accessToken);
    await adapter.verify(token.accessToken);

    const connection = await db.$transaction(async (tx) => {
      const existing = await tx.providerConnection.findFirst({
        where: {
          brandId: attempt.brandId,
          provider: input.provider,
          externalAccountId: identity.externalAccountId,
        },
      });
      const data = {
        organizationId: attempt.organizationId,
        workspaceId: attempt.workspaceId,
        brandId: attempt.brandId,
        provider: input.provider,
        status: "CONNECTED",
        externalAccountId: identity.externalAccountId,
        externalAccountName: identity.externalAccountName,
        credentialCiphertext: encryptString(token.accessToken),
        refreshTokenCiphertext: token.refreshToken ? encryptString(token.refreshToken) : null,
        tokenExpiresAt: token.expiresAt ?? null,
        scopes: json(token.scopes ?? adapter.defaultScopes),
        capabilities: json(adapter.capabilities),
        health: json({ ok: true, checkedAt: new Date().toISOString() }),
        lastVerifiedAt: new Date(),
        lastErrorCode: null,
        lastErrorMessage: null,
        revokedAt: null,
      };

      const row = existing
        ? await tx.providerConnection.update({ where: { id: existing.id }, data })
        : await tx.providerConnection.create({ data: { id: randomUUID(), ...data } });

      // Resource discovery is authoritative for the current verification cycle.
      // Mark previous resources stale first, then reactivate/upsert what the provider still returns.
      await tx.providerResource.updateMany({
        where: { connectionId: row.id, status: { not: "REVOKED" } },
        data: { status: "STALE" },
      });

      for (const resource of resources) {
        const persistedResource = await tx.providerResource.upsert({
          where: {
            connectionId_resourceType_externalId: {
              connectionId: row.id,
              resourceType: resource.resourceType,
              externalId: resource.externalId,
            },
          },
          update: {
            name: resource.name,
            status: "ACTIVE",
            capabilities: json(resource.capabilities ?? []),
            metadata: json(resource.metadata ?? {}),
            credentialCiphertext: resource.credential ? encryptString(resource.credential) : undefined,
          },
          create: {
            id: randomUUID(),
            connectionId: row.id,
            resourceType: resource.resourceType,
            externalId: resource.externalId,
            name: resource.name,
            status: "ACTIVE",
            capabilities: json(resource.capabilities ?? []),
            metadata: json(resource.metadata ?? {}),
            credentialCiphertext: resource.credential ? encryptString(resource.credential) : null,
          },
        });
        if (input.provider === "META" && resource.resourceType === "FACEBOOK_PAGE" && resource.credential) {
          await tx.facebookAccount.upsert({
            where: { ownerRef_pageId: { ownerRef: "local", pageId: resource.externalId } },
            create: {
              ownerRef: "local",
              organizationId: attempt.organizationId,
              brandId: attempt.brandId,
              pageId: resource.externalId,
              pageName: resource.name,
              accessToken: encryptString(resource.credential),
              status: "ACTIVE",
              providerResourceId: persistedResource.id,
            },
            update: {
              organizationId: attempt.organizationId,
              brandId: attempt.brandId,
              pageName: resource.name,
              accessToken: encryptString(resource.credential),
              status: "ACTIVE",
              providerResourceId: persistedResource.id,
            },
          });
        }
      }

      await tx.providerOAuthAttempt.update({
        where: { id: attempt.id },
        data: { status: "COMPLETED", completedAt: new Date(), errorCode: null, errorMessage: null },
      });
      return row;
    });

    await auditProviderConnection(db, {
      organizationId: attempt.organizationId,
      action: "PROVIDER_CONNECTED",
      targetId: connection.id,
      correlationId: attempt.id,
      metadata: {
        provider: input.provider,
        workspaceId: attempt.workspaceId,
        brandId: attempt.brandId,
        externalAccountId: connection.externalAccountId,
        resourceCount: resources.length,
        scopes: token.scopes ?? adapter.defaultScopes,
      },
    });
    return connection;
  } catch (error) {
    const message = redactProviderError(error);
    await db.providerOAuthAttempt.update({
      where: { id: attempt.id },
      data: { status: "FAILED", completedAt: new Date(), errorCode: "OAUTH_CALLBACK_FAILED", errorMessage: message },
    }).catch(() => undefined);
    await auditProviderConnection(db, {
      organizationId: attempt.organizationId,
      action: "PROVIDER_OAUTH_FAILED",
      targetType: "PROVIDER_OAUTH_ATTEMPT",
      targetId: attempt.id,
      correlationId: attempt.id,
      metadata: {
        provider: input.provider,
        workspaceId: attempt.workspaceId,
        brandId: attempt.brandId,
        error: message,
      },
    }).catch(() => undefined);
    throw new Error(message);
  }
}

export async function getProviderConnections(db: PrismaClient) {
  const tenant = await resolveLocalTenant(db);
  const rows = await db.providerConnection.findMany({
    where: {
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      brandId: tenant.brandId,
    },
    include: { resources: { orderBy: { name: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    status: normalizedProviderState(row),
    externalAccountId: row.externalAccountId,
    externalAccountName: row.externalAccountName,
    scopes: arrayOfStrings(row.scopes),
    capabilities: arrayOfStrings(row.capabilities),
    health: row.health,
    tokenExpiresAt: row.tokenExpiresAt?.toISOString() ?? null,
    lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
    lastErrorCode: row.lastErrorCode,
    lastErrorMessage: row.lastErrorMessage,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    resources: row.resources.map((resource) => ({
      id: resource.id,
      resourceType: resource.resourceType,
      externalId: resource.externalId,
      name: resource.name,
      status: resource.status,
      capabilities: arrayOfStrings(resource.capabilities),
      metadata: resource.metadata,
    })),
  }));
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function normalizedProviderState(row: {
  status: string;
  tokenExpiresAt: Date | null;
  revokedAt: Date | null;
}) {
  if (row.revokedAt || row.status === "REVOKED") return "REVOKED";
  if (row.tokenExpiresAt && row.tokenExpiresAt <= new Date()) return "AUTH_EXPIRED";
  return row.status as ProviderConnectionState;
}

export async function verifyProviderConnection(db: PrismaClient, connectionId: string) {
  const tenant = await resolveLocalTenant(db);
  const connection = await db.providerConnection.findFirst({
    where: {
      id: connectionId,
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      brandId: tenant.brandId,
    },
  });
  if (!connection) throw new Error("PROVIDER_CONNECTION_NOT_FOUND");
  if (connection.revokedAt) throw new Error("PROVIDER_CONNECTION_REVOKED");
  const adapter = getProviderConnectionAdapter(connection.provider);
  if (!adapter) throw new Error("PROVIDER_NOT_SUPPORTED");
  if (!connection.credentialCiphertext) throw new Error("PROVIDER_CREDENTIAL_MISSING");

  if (connection.tokenExpiresAt && connection.tokenExpiresAt <= new Date()) {
    await db.providerConnection.update({
      where: { id: connection.id },
      data: {
        status: "AUTH_EXPIRED",
        health: json({ ok: false, checkedAt: new Date().toISOString() }),
        lastVerifiedAt: new Date(),
        lastErrorCode: "AUTH_EXPIRED",
        lastErrorMessage: "Credential expired.",
      },
    });
    await auditProviderConnection(db, {
      organizationId: connection.organizationId,
      action: "PROVIDER_AUTH_EXPIRED",
      targetId: connection.id,
      correlationId: connection.id,
      metadata: { provider: connection.provider, expiresAt: connection.tokenExpiresAt.toISOString() },
    }).catch(() => undefined);
    return { ok: false as const, status: "AUTH_EXPIRED" as const };
  }

  try {
    await adapter.verify(decryptString(connection.credentialCiphertext));
    const resources = await adapter.discoverResources(decryptString(connection.credentialCiphertext));
    await db.$transaction(async (tx) => {
      await tx.providerConnection.update({
        where: { id: connection.id },
        data: {
          status: "CONNECTED",
          health: json({ ok: true, checkedAt: new Date().toISOString() }),
          lastVerifiedAt: new Date(),
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      });
      await tx.providerResource.updateMany({
        where: { connectionId: connection.id, status: { not: "REVOKED" } },
        data: { status: "STALE" },
      });
      for (const resource of resources) {
        const persistedResource = await tx.providerResource.upsert({
          where: { connectionId_resourceType_externalId: { connectionId: connection.id, resourceType: resource.resourceType, externalId: resource.externalId } },
          update: {
            name: resource.name,
            status: "ACTIVE",
            capabilities: json(resource.capabilities ?? []),
            metadata: json(resource.metadata ?? {}),
            credentialCiphertext: resource.credential ? encryptString(resource.credential) : undefined,
          },
          create: {
            id: randomUUID(),
            connectionId: connection.id,
            resourceType: resource.resourceType,
            externalId: resource.externalId,
            name: resource.name,
            capabilities: json(resource.capabilities ?? []),
            metadata: json(resource.metadata ?? {}),
            credentialCiphertext: resource.credential ? encryptString(resource.credential) : null,
          },
        });
        if (connection.provider === "META" && resource.resourceType === "FACEBOOK_PAGE" && resource.credential) {
          await tx.facebookAccount.upsert({
            where: { ownerRef_pageId: { ownerRef: "local", pageId: resource.externalId } },
            create: {
              ownerRef: "local",
              organizationId: connection.organizationId,
              brandId: connection.brandId,
              pageId: resource.externalId,
              pageName: resource.name,
              accessToken: encryptString(resource.credential),
              status: "ACTIVE",
              providerResourceId: persistedResource.id,
            },
            update: {
              organizationId: connection.organizationId,
              brandId: connection.brandId,
              pageName: resource.name,
              accessToken: encryptString(resource.credential),
              status: "ACTIVE",
              providerResourceId: persistedResource.id,
            },
          });
        }
      }
    });
    await auditProviderConnection(db, {
      organizationId: connection.organizationId,
      action: "PROVIDER_VERIFIED",
      targetId: connection.id,
      correlationId: connection.id,
      metadata: { provider: connection.provider, resourceCount: resources.length, status: "CONNECTED" },
    });
    return { ok: true as const, status: "CONNECTED" as const };
  } catch (error) {
    const message = redactProviderError(error);
    const auth = /401|invalid token|expired|oauth|190/i.test(message);
    const status = auth ? "REAUTH_REQUIRED" : "DEGRADED";
    await db.providerConnection.update({
      where: { id: connection.id },
      data: {
        status,
        health: json({ ok: false, checkedAt: new Date().toISOString() }),
        lastVerifiedAt: new Date(),
        lastErrorCode: auth ? "AUTH_INVALID" : "VERIFY_FAILED",
        lastErrorMessage: message,
      },
    });
    await auditProviderConnection(db, {
      organizationId: connection.organizationId,
      action: "PROVIDER_VERIFY_FAILED",
      targetId: connection.id,
      correlationId: connection.id,
      metadata: { provider: connection.provider, status, error: message },
    }).catch(() => undefined);
    return { ok: false as const, status, error: message };
  }
}

export async function refreshProviderConnection(db: PrismaClient, connectionId: string) {
  const tenant = await resolveLocalTenant(db);
  const connection = await db.providerConnection.findFirst({
    where: { id: connectionId, organizationId: tenant.organizationId, workspaceId: tenant.workspaceId, brandId: tenant.brandId },
  });
  if (!connection) throw new Error("PROVIDER_CONNECTION_NOT_FOUND");
  const adapter = getProviderConnectionAdapter(connection.provider);
  if (!adapter?.refreshToken) throw new Error("PROVIDER_REFRESH_NOT_SUPPORTED");
  if (!connection.refreshTokenCiphertext) throw new Error("PROVIDER_REFRESH_TOKEN_MISSING");
  const clientId = process.env[adapter.env.clientId];
  const clientSecret = process.env[adapter.env.clientSecret];
  if (!clientId || !clientSecret) throw new Error("PROVIDER_NOT_CONFIGURED");

  try {
    const next = await adapter.refreshToken({
      refreshToken: decryptString(connection.refreshTokenCiphertext),
      clientId,
      clientSecret,
    });
    await db.providerConnection.update({
      where: { id: connection.id },
      data: {
        credentialCiphertext: encryptString(next.accessToken),
        refreshTokenCiphertext: next.refreshToken
          ? encryptString(next.refreshToken)
          : connection.refreshTokenCiphertext,
        tokenExpiresAt: next.expiresAt ?? null,
        status: "CONNECTED",
        lastErrorCode: null,
        lastErrorMessage: null,
        lastVerifiedAt: new Date(),
      },
    });
    await auditProviderConnection(db, {
      organizationId: connection.organizationId,
      action: "PROVIDER_CREDENTIAL_REFRESHED",
      targetId: connection.id,
      correlationId: connection.id,
      metadata: { provider: connection.provider, expiresAt: next.expiresAt?.toISOString() ?? null },
    });
    return verifyProviderConnection(db, connection.id);
  } catch (error) {
    const message = redactProviderError(error);
    await db.providerConnection.update({
      where: { id: connection.id },
      data: { status: "REAUTH_REQUIRED", lastErrorCode: "REFRESH_FAILED", lastErrorMessage: message },
    });
    await auditProviderConnection(db, {
      organizationId: connection.organizationId,
      action: "PROVIDER_REFRESH_FAILED",
      targetId: connection.id,
      correlationId: connection.id,
      metadata: { provider: connection.provider, error: message },
    }).catch(() => undefined);
    throw new Error(message);
  }
}

export async function upsertManualMetaPageConnection(
  db: PrismaClient,
  input: { pageId: string; pageName: string; pageAccessToken: string },
) {
  const tenant = await resolveLocalTenant(db);
  const existing = await db.providerConnection.findFirst({
    where: {
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      brandId: tenant.brandId,
      provider: "META",
      externalAccountId: input.pageId,
    },
  });
  const connection = existing
    ? await db.providerConnection.update({
        where: { id: existing.id },
        data: {
          status: "CONNECTED",
          externalAccountName: input.pageName,
          credentialCiphertext: encryptString(input.pageAccessToken),
          scopes: json([]),
          capabilities: json(["social.facebook.publish", "social.facebook.analytics"]),
          health: json({ ok: true, source: "manual-page-token", checkedAt: new Date().toISOString() }),
          lastVerifiedAt: new Date(),
          lastErrorCode: null,
          lastErrorMessage: null,
          revokedAt: null,
        },
      })
    : await db.providerConnection.create({
        data: {
          id: randomUUID(),
          organizationId: tenant.organizationId,
          workspaceId: tenant.workspaceId,
          brandId: tenant.brandId,
          provider: "META",
          status: "CONNECTED",
          externalAccountId: input.pageId,
          externalAccountName: input.pageName,
          credentialCiphertext: encryptString(input.pageAccessToken),
          scopes: json([]),
          capabilities: json(["social.facebook.publish", "social.facebook.analytics"]),
          health: json({ ok: true, source: "manual-page-token", checkedAt: new Date().toISOString() }),
          lastVerifiedAt: new Date(),
        },
      });

  const resource = await db.providerResource.upsert({
    where: {
      connectionId_resourceType_externalId: {
        connectionId: connection.id,
        resourceType: "FACEBOOK_PAGE",
        externalId: input.pageId,
      },
    },
    update: {
      name: input.pageName,
      status: "ACTIVE",
      capabilities: json(["social.facebook.publish", "social.facebook.analytics"]),
      credentialCiphertext: encryptString(input.pageAccessToken),
      metadata: json({ source: "legacy-manual-connect" }),
    },
    create: {
      id: randomUUID(),
      connectionId: connection.id,
      resourceType: "FACEBOOK_PAGE",
      externalId: input.pageId,
      name: input.pageName,
      status: "ACTIVE",
      capabilities: json(["social.facebook.publish", "social.facebook.analytics"]),
      credentialCiphertext: encryptString(input.pageAccessToken),
      metadata: json({ source: "legacy-manual-connect" }),
    },
  });

  return { connection, resource };
}

export async function revokeProviderConnection(db: PrismaClient, connectionId: string) {
  const tenant = await resolveLocalTenant(db);
  const connection = await db.providerConnection.findFirst({
    where: { id: connectionId, organizationId: tenant.organizationId, workspaceId: tenant.workspaceId, brandId: tenant.brandId },
  });
  if (!connection) throw new Error("PROVIDER_CONNECTION_NOT_FOUND");
  const adapter = getProviderConnectionAdapter(connection.provider);
  if (adapter?.revoke && connection.credentialCiphertext) {
    try { await adapter.revoke(decryptString(connection.credentialCiphertext)); } catch {}
  }
  await db.facebookAccount.updateMany({
    where: { providerResource: { connectionId } },
    data: { status: "REVOKED" },
  });
  await db.providerResource.updateMany({ where: { connectionId }, data: { status: "REVOKED", credentialCiphertext: null } });
  const revoked = await db.providerConnection.update({
    where: { id: connectionId },
    data: {
      status: "REVOKED",
      revokedAt: new Date(),
      credentialCiphertext: null,
      refreshTokenCiphertext: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  });
  await auditProviderConnection(db, {
    organizationId: connection.organizationId,
    action: "PROVIDER_REVOKED",
    targetId: connection.id,
    correlationId: connection.id,
    metadata: { provider: connection.provider, remoteRevokeSupported: Boolean(adapter?.revoke) },
  });
  return revoked;
}
