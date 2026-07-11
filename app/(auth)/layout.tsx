// Minimal layout for the auth route group — no sidebar/topbar, no auth gate. Centers the
// login/signup card.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      {children}
    </div>
  );
}
