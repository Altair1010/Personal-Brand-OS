import { AuthGate } from "@/components/auth/AuthGate";
import { AppShell } from "@/components/layout/AppShell";

// Dashboard route-group layout: hard auth gate around the app shell. Everything under
// (dashboard) requires a Supabase session (EM1b). The (auth) group is intentionally outside.
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <AppShell>{children}</AppShell>
    </AuthGate>
  );
}
