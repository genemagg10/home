import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Browser/anon client — read-only for the dashboard (RLS allows select).
export function supabaseAnon(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// Next.js wraps global fetch and caches GET requests by default. supabase-js
// uses fetch under the hood, so without this the dashboard would keep serving a
// cached snapshot and edits wouldn't appear until the cache expired. Forcing
// no-store makes every read hit the live database.
const freshFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: "no-store" });

// Server-only client using the service role. Bypasses RLS — never ship to client.
export function supabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase admin not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false },
    global: { fetch: freshFetch },
  });
}

export const isSupabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
