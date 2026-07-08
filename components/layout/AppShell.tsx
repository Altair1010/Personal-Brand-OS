import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { PageContainer } from "./PageContainer";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <PageContainer>{children}</PageContainer>
      </div>
    </div>
  );
}
