import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { SettingsData } from "@/app/(dashboard)/settings/actions";

export function AgentRoutingPanel({
  routing,
}: {
  routing: SettingsData["routing"];
}) {
  return (
    <Card>
      <CardContent className="space-y-4 py-6">
        <div>
          <h2 className="text-base font-semibold">AI execution routing</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Product AI uses Agent Control Plane. OpenClaw is preferred; OAuth workers are fallback.
            Direct model API-key execution is not used by active product routes.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="default">AGENT FIRST</Badge>
          <Badge variant={routing.openClawReady ? "default" : "outline"}>
            OpenClaw {routing.openClawReady ? "ONLINE" : "OFFLINE"}
          </Badge>
          <Badge variant={routing.oauthReady ? "default" : "outline"}>
            OAuth {routing.oauthReady ? "ONLINE" : "OFFLINE"}
          </Badge>
        </div>

        <div className="space-y-2">
          {routing.workers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Agent worker registered.</p>
          ) : (
            routing.workers.map((worker) => (
              <div key={worker.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{worker.id}</span>
                  <Badge variant={worker.fresh ? "default" : "outline"}>
                    {worker.fresh ? "ONLINE" : worker.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{worker.adapter}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {worker.capabilities.join(" · ") || "No capabilities"}
                </p>
              </div>
            ))
          )}
        </div>

        {routing.legacyApiKeyConfigs > 0 && (
          <p className="text-xs text-muted-foreground">
            {routing.legacyApiKeyConfigs} historical API-key configuration record(s) remain in the
            local database for migration/audit only. They are not an active AI execution path.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
