"use client";

// Shared email/password form for login + signup (mode prop). Talks to Supabase Auth directly
// from the client; on success routes to the dashboard "/". The dashboard's AuthGate then
// binds the account. No secrets here — the anon key is publishable.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseClient } from "@/lib/supabase";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isSignup = mode === "signup";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      const supabase = await getSupabaseClient();
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // When email confirmation is required, there is no session yet.
        if (!data.session) {
          setNotice(
            "Đã tạo tài khoản. Kiểm tra email để xác nhận (nếu bật), rồi đăng nhập.",
          );
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
      router.replace("/");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Xác thực thất bại. Thử lại.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardContent className="space-y-4 py-6">
        <div className="space-y-1 text-center">
          <h1 className="text-lg font-semibold">
            {isSignup ? "Tạo tài khoản" : "Đăng nhập"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Personal Brand OS — đồng bộ & sao lưu đám mây
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Mật khẩu</Label>
            <Input
              id="password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {notice && !error && (
            <p className="text-sm text-muted-foreground">{notice}</p>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {isSignup ? "Đăng ký" : "Đăng nhập"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {isSignup ? (
            <>
              Đã có tài khoản?{" "}
              <Link href="/login" className="font-medium text-foreground underline">
                Đăng nhập
              </Link>
            </>
          ) : (
            <>
              Chưa có tài khoản?{" "}
              <Link href="/signup" className="font-medium text-foreground underline">
                Đăng ký
              </Link>
            </>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
