"use client";

// Browser-side Supabase client (Electron renderer). Config is fetched at runtime via the
// getSupabaseConfig server action — NOT baked in as NEXT_PUBLIC, because the packaged app
// receives SUPABASE_* only after build (via pbos.env). Session persists in localStorage
// (fixed localhost origin), so login survives app restarts.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/auth/actions";

let clientPromise: Promise<SupabaseClient> | null = null;

/**
 * Lazily create (and cache) the browser Supabase client. Rejects when Supabase is
 * unconfigured — callers (AuthGate) surface a "configure Supabase" notice. The promise is
 * only cached on success, so a fixed config typo can be retried after the user edits env.
 */
export function getSupabaseClient(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = getSupabaseConfig()
      .then(({ url, anonKey }) =>
        createClient(url, anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
          },
        }),
      )
      .catch((e) => {
        clientPromise = null; // allow retry after the user fixes config
        throw e;
      });
  }
  return clientPromise;
}
