"use server";

// Server actions for cloud push/pull. The client passes its Supabase access token; the server
// builds a user-scoped Supabase client (anon key + Bearer header — NO service key, so RLS
// applies) and RE-VERIFIES the token via auth.getUser() before any Storage op. The gate in the
// UI is UX; this verification is the security boundary.

import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { getSupabaseConfigOrThrow } from "@/lib/supabase-config";
import { pushSnapshot, pullSnapshot } from "@/lib/cloud-backup";

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const MIN_PASSPHRASE = 8;

function userScopedClient(accessToken: string) {
  const { url, anonKey } = getSupabaseConfigOrThrow();
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requireUser(accessToken: string, passphrase: string) {
  if (!accessToken) throw new Error("Thiếu phiên đăng nhập.");
  if (!passphrase || passphrase.length < MIN_PASSPHRASE) {
    throw new Error(`Passphrase phải từ ${MIN_PASSPHRASE} ký tự trở lên.`);
  }
  const supabase = userScopedClient(accessToken);
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Phiên đăng nhập không hợp lệ.");
  return { supabase, userId: data.user.id };
}

export async function cloudPush(
  accessToken: string,
  passphrase: string,
): Promise<ActionResult> {
  try {
    const { supabase, userId } = await requireUser(accessToken, passphrase);
    await pushSnapshot(db, supabase, userId, passphrase);
    return { ok: true, data: undefined };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Sao lưu lên cloud thất bại.",
    };
  }
}

export async function cloudPull(
  accessToken: string,
  passphrase: string,
): Promise<ActionResult> {
  try {
    const { supabase, userId } = await requireUser(accessToken, passphrase);
    await pullSnapshot(db, supabase, userId, passphrase);
    return { ok: true, data: undefined };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Khôi phục từ cloud thất bại.",
    };
  }
}
