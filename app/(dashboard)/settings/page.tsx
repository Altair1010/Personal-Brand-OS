import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { AgentRoutingPanel } from "@/components/settings/AgentRoutingPanel";
import { ConnectionCenter } from "@/components/settings/ConnectionCenter";
import { ControlPlanePanel } from "@/components/settings/ControlPlanePanel";
import { ContentGenInfoPanel } from "@/components/settings/ContentGenInfoPanel";
import { BackupPanel } from "@/components/settings/BackupPanel";
import { DangerZone } from "@/components/settings/DangerZone";
import { EnvVaultPanel } from "@/components/settings/EnvVaultPanel";
import { getSettingsData } from "./actions";

export const dynamic = "force-dynamic";

const tabs = [
  { id: "connections", label: "Connections" },
  { id: "env", label: ".ENV" },
  { id: "agents", label: "Agents" },
  { id: "system", label: "System" },
] as const;

type TabId = typeof tabs[number]["id"];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const selected = tabs.some((tab) => tab.id === params.tab)
    ? (params.tab as TabId)
    : "connections";
  const data = selected === "agents" || selected === "system"
    ? await getSettingsData()
    : null;

  return (
    <>
      <PageHeader
        title="Settings"
        description="Quản trị kết nối, biến môi trường an toàn, Agent và hệ thống vận hành."
      />
      <div className="space-y-5">
        <nav className="inline-flex flex-wrap gap-1 rounded-2xl border border-white/25 bg-[var(--neu-raised)] p-1.5 [box-shadow:var(--shadow-raised-sm)]">
          {tabs.map((tab) => {
            const active = selected === tab.id;
            return (
              <Link
                key={tab.id}
                href={"/settings?tab=" + tab.id}
                className={[
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  tab.id === "env" ? "font-mono" : "",
                  active
                    ? "bg-[var(--neu-pressed)] text-[var(--neu-teal)] [box-shadow:var(--shadow-pressed)]"
                    : "text-muted-foreground hover:bg-[var(--neu-teal-soft)] hover:text-[var(--neu-teal)]",
                ].join(" ")}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {selected === "connections" && <ConnectionCenter />}
        {selected === "env" && <EnvVaultPanel />}
        {selected === "agents" && data && (
          <div className="space-y-6">
            <AgentRoutingPanel routing={data.routing} />
            <ControlPlanePanel controlPlane={data.controlPlane} />
          </div>
        )}
        {selected === "system" && (
          <div className="space-y-6">
            <ContentGenInfoPanel />
            <BackupPanel />
            <DangerZone />
          </div>
        )}
      </div>
    </>
  );
}
