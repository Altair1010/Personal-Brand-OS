"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { ExternalLink, Link2, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type ProviderSummary = {
  id: "META" | "LINKEDIN" | "GOOGLE_SEARCH_CONSOLE";
  label: string;
  category: "SOCIAL" | "SEARCH";
  capabilities: string[];
  configured: boolean;
  supportsRefresh: boolean;
  supportsRevoke: boolean;
};

type Resource = {
  id: string;
  resourceType: string;
  externalId: string;
  name: string;
  status: string;
  capabilities: string[];
  metadata: unknown;
};

type Connection = {
  id: string;
  provider: string;
  status: string;
  externalAccountId: string | null;
  externalAccountName: string | null;
  scopes: string[];
  capabilities: string[];
  health: unknown;
  tokenExpiresAt: string | null;
  lastVerifiedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  revokedAt: string | null;
  resources: Resource[];
};

const pathByProvider: Record<string, string> = {
  META: "meta",
  LINKEDIN: "linkedin",
  GOOGLE_SEARCH_CONSOLE: "google-search-console",
};

function statusVariant(status: string) {
  return status === "CONNECTED" ? "default" : "outline";
}

function formatTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export function ConnectionCenter() {
  const searchParams = useSearchParams();
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(
    searchParams.get("providerError"),
  );
  const [notice, setNotice] = useState<string | null>(
    searchParams.get("providerConnected")
      ? `Đã kết nối ${searchParams.get("providerConnected")}.`
      : null,
  );
  const [busy, startTransition] = useTransition();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/providers/connections", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "LOAD_CONNECTIONS_FAILED");
      setProviders(payload.data.providers);
      setConnections(payload.data.connections);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "LOAD_CONNECTIONS_FAILED");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const connectionByProvider = useMemo(() => {
    const map = new Map<string, Connection[]>();
    for (const connection of connections) {
      const list = map.get(connection.provider) ?? [];
      list.push(connection);
      map.set(connection.provider, list);
    }
    return map;
  }, [connections]);

  function connect(provider: ProviderSummary) {
    if (!provider.configured) {
      setError(`${provider.label}: OAuth app credentials chưa được cấu hình cho deployment này.`);
      return;
    }
    window.location.assign(`/api/providers/${pathByProvider[provider.id]}/connect`);
  }

  function runAction(connectionId: string, action: "verify" | "refresh" | "revoke") {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/providers/connections", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ connectionId, action }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error || "PROVIDER_ACTION_FAILED");
        setNotice(
          action === "revoke"
            ? "Đã thu hồi kết nối."
            : action === "refresh"
              ? "Đã refresh credential và kiểm tra lại kết nối."
              : "Đã kiểm tra lại kết nối.",
        );
        await load();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "PROVIDER_ACTION_FAILED");
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-5 py-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h2 className="text-base font-semibold">Connection Center</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              OAuth, account/resource discovery, capability state và credential health cho các external providers.
              Token được lưu mã hóa phía server và không được trả về UI.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" disabled={loading || busy} onClick={() => void load()}>
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        </div>

        {notice && <div className="rounded-md border px-3 py-2 text-sm">{notice}</div>}
        {error && <div className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">{error}</div>}

        <div className="grid gap-4 xl:grid-cols-3">
          {providers.map((provider) => {
            const rows = connectionByProvider.get(provider.id) ?? [];
            const active = rows.find((row) => row.status !== "REVOKED") ?? rows[0] ?? null;
            return (
              <section key={provider.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link2 className="size-4" />
                      <h3 className="text-sm font-semibold">{provider.label}</h3>
                    </div>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                      {provider.category}
                    </p>
                  </div>
                  <Badge variant={active ? statusVariant(active.status) : "outline"}>
                    {active?.status ?? (provider.configured ? "READY" : "NOT CONFIGURED")}
                  </Badge>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {provider.capabilities.map((capability) => (
                    <span key={capability} className="rounded border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {capability}
                    </span>
                  ))}
                </div>

                {!active ? (
                  <div className="mt-4 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      {provider.configured
                        ? "Chưa có account được kết nối cho Brand hiện tại."
                        : "Deployment chưa có OAuth app credentials cho provider này."}
                    </p>
                    <Button type="button" size="sm" disabled={!provider.configured} onClick={() => connect(provider)}>
                      <ExternalLink className="size-4" />
                      Connect
                    </Button>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-sm font-medium">{active.externalAccountName || active.externalAccountId || "Connected account"}</p>
                      <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                        <span>Last verified: {formatTime(active.lastVerifiedAt)}</span>
                        <span>Expires: {formatTime(active.tokenExpiresAt)}</span>
                        <span>Resources: {active.resources.length}</span>
                        {active.lastErrorCode && <span className="text-destructive">{active.lastErrorCode}: {active.lastErrorMessage}</span>}
                      </div>
                    </div>

                    {active.resources.length > 0 && (
                      <div className="space-y-1.5">
                        {active.resources.map((resource) => (
                          <div key={resource.id} className="flex items-center justify-between gap-3 rounded border px-2.5 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium">{resource.name}</p>
                              <p className="truncate font-mono text-[10px] text-muted-foreground">
                                {resource.resourceType} · {resource.externalId}
                              </p>
                            </div>
                            <Badge variant="outline">{resource.status}</Badge>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => runAction(active.id, "verify")}>
                        <ShieldCheck className="size-4" />
                        Verify
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy || !provider.supportsRefresh || !active.status.match(/AUTH_EXPIRED|REAUTH_REQUIRED|DEGRADED|CONNECTED/)}
                        onClick={() => runAction(active.id, "refresh")}
                      >
                        <RefreshCw className="size-4" />
                        Refresh token
                      </Button>
                      <Button type="button" size="sm" variant="outline" disabled={busy || active.status === "REVOKED"} onClick={() => runAction(active.id, "revoke")}>
                        <Unplug className="size-4" />
                        Revoke
                      </Button>
                      {active.status === "REVOKED" || active.status === "AUTH_EXPIRED" || active.status === "REAUTH_REQUIRED" ? (
                        <Button type="button" size="sm" onClick={() => connect(provider)}>
                          Reconnect
                        </Button>
                      ) : null}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {loading && providers.length === 0 && (
          <p className="text-sm text-muted-foreground">Đang tải connection state…</p>
        )}
      </CardContent>
    </Card>
  );
}
