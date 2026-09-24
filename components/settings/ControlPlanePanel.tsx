import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ControlPlaneItem, SettingsData } from "@/app/(dashboard)/settings/actions";

function Section({
  title,
  items,
}: {
  title: string;
  items: ControlPlaneItem[];
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="grid gap-2 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{item.label}</span>
              <Badge variant={item.tone === "ok" ? "default" : "outline"}>{item.status}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ControlPlanePanel({
  controlPlane,
}: {
  controlPlane: SettingsData["controlPlane"];
}) {
  return (
    <Card>
      <CardContent className="space-y-6 py-6">
        <div>
          <h2 className="text-base font-semibold">Control Plane</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Operational view of Piltover infrastructure, codebase, server, issues and Agent runtime.
            This is administration state, not onboarding configuration.
          </p>
        </div>

        <Section title="Infrastructure" items={controlPlane.infrastructure} />
        <Section title="Codebase" items={controlPlane.codebase} />
        <Section title="Server" items={controlPlane.server} />
        <Section title="Issues" items={controlPlane.issues} />
        <Section title="Agents" items={controlPlane.agents} />

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Future control surfaces</h3>
          <div className="grid gap-2 md:grid-cols-2">
            {controlPlane.futureSlots.map((slot) => (
              <div key={slot} className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                {slot}
              </div>
            ))}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
