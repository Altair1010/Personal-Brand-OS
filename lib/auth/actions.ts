"use server";

import { db } from "@/lib/db";
import { getSupabaseConfigOrThrow, type SupabaseConfig } from "@/lib/supabase-config";

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Runtime Supabase config for the client. The anon key is publishable, so exposing it to
 * the Electron renderer is safe. Throws (caught by AuthGate) when unconfigured.
 */
export async function getSupabaseConfig(): Promise<SupabaseConfig> {
  return getSupabaseConfigOrThrow();
}

/**
 * Bind the local data to a Supabase account on first login. Idempotent: only writes when
 * AppState.supabaseUserId is null OR already equals this user (never silently reassigns to a
 * different account — that would mean restoring someone else's snapshot over local data).
 * Cloud push/pull (EM1b session 2) will use this binding to scope the Storage path.
 */
export async function bindAccount(
  supabaseUserId: string,
): Promise<ActionResult<{ bound: boolean; mismatch: boolean }>> {
  if (!supabaseUserId || typeof supabaseUserId !== "string") {
    return { ok: false, error: "Thiếu supabaseUserId." };
  }
  try {
    const state = await db.appState.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
      select: { supabaseUserId: true },
    });

    if (state.supabaseUserId && state.supabaseUserId !== supabaseUserId) {
      // Local data already belongs to another account — do not overwrite the binding.
      return { ok: true, data: { bound: false, mismatch: true } };
    }

    if (!state.supabaseUserId) {
      await db.appState.update({
        where: { id: "singleton" },
        data: { supabaseUserId },
      });
    }
    return { ok: true, data: { bound: true, mismatch: false } };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Gắn tài khoản thất bại.",
    };
  }
}
