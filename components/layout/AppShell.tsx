import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { PageContainer } from "./PageContainer";
import { AgentSidebar } from "@/components/agent/AgentSidebar";
import { CommandPalette } from "./CommandPalette";
import { RealtimeRefresh } from "./RealtimeRefresh";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="piltover-soft-ui flex h-screen overflow-hidden bg-[var(--neu-base)]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <PageContainer>{children}</PageContainer>
      </div>
      <AgentSidebar />
      <CommandPalette />
      <RealtimeRefresh />
    </div>
  );
}
