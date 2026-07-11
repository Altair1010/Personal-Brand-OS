"use client";

// Hard auth gate (EM1b decision): the dashboard is inaccessible until logged in. Client-side
// gate (no middleware — the app is a single-user Electron/standalone build). Wraps AppShell in
// app/(dashboard)/layout.tsx; unauthenticated users are redirected to /login (its own (auth)
// layout, ungated). Server actions for cloud backup re-check the access token — the gate is UX,
// not the security boundary.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { bindAccount } from "@/lib/auth/actions";

type Status = "loading" | "authed" | "unauthed" | "unconfigured";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let active = true;
    let unsub: (() => void) | undefined;

    getSupabaseClient()
      .then(async (supabase) => {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!active) return;
        if (session) {
          void bindAccount(session.user.id);
          setStatus("authed");
        } else {
          setStatus("unauthed");
        }

        const { data } = supabase.auth.onAuthStateChange((_event, s) => {
          if (!active) return;
          if (s) {
            void bindAccount(s.user.id);
            setStatus("authed");
          } else {
            setStatus("unauthed");
          }
        });
        unsub = () => data.subscription.unsubscribe();
      })
      .catch(() => {
        if (active) setStatus("unconfigured");
      });

    return () => {
      active = false;
      unsub?.();
    };
  }, []);

  useEffect(() => {
    if (status === "unauthed") router.replace("/login");
  }, [status, router]);

  if (status === "authed") return <>{children}</>;

  if (status === "unconfigured") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertTriangle className="size-8 text-amber-500" />
        <h1 className="text-lg font-semibold">Chưa cấu hình Supabase</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Điền <code>SUPABASE_URL</code> và <code>SUPABASE_ANON_KEY</code> vào{" "}
          <code>.env</code> (dev) hoặc <code>pbos.env</code> (bản đóng gói), rồi mở lại app.
          Xem ToFill.md §5.
        </p>
      </div>
    );
  }

  // loading | unauthed (mid-redirect)
  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
