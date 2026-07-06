import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service_role key. NEVER import this
 * into a client component or expose the key to the browser. Used only inside
 * server route handlers (e.g. sending invites).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Invites are not configured yet (missing server admin key).");
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
