import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client using the service role key.
 *
 * The service role key bypasses Row Level Security, which is intentional —
 * all of Stint's writes go through Next.js API routes that validate the
 * Clerk user before touching the database. Never import this from client
 * components.
 *
 * Cached as a module-level singleton so we don't reinstantiate the client
 * on every request.
 */

let cachedClient = null;

export function getSupabaseAdmin() {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase environment variables. Check .env.local for NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedClient;
}