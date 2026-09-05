// Server-only Supabase config resolver. Reads SUPABASE_URL / SUPABASE_ANON_KEY from the
// process env (dev: repo .env; prod: userData/pbos.env injected by electron/runtime.js
// loadUserEnv). The anon key is publishable (safe to expose to the Electron renderer via a
// server action) — it is NOT a secret. Never read the repo .env in prod (project rule 3);
// that is already handled upstream (only pbos.env keys are injected in packaged mode).
//
// NOT importable from client components — keep imports to server actions / route handlers.

export type SupabaseConfig = { url: string; anonKey: string };

/** Read the Supabase config, throwing a clear VN error when unconfigured (ToFill §5). */
export function getSupabaseConfigOrThrow(): SupabaseConfig {
  const url = process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    throw new Error(
      "Chưa cấu hình Supabase. Điền SUPABASE_URL và SUPABASE_ANON_KEY vào .env (dev) " +
        "hoặc cấu hình runtime tương ứng của bản đóng gói.",
    );
  }
  return { url, anonKey };
}
