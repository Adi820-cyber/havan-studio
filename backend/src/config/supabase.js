/**
 * Server-side Supabase client factory.
 *
 * Two flavours:
 *
 *   1. `adminClient` — created with the service_role key. Bypasses RLS for
 *      operations that need elevated access (e.g., reading profiles for SSE).
 *      **Never** expose this to the browser.
 *
 *   2. `createUserClient(accessToken)` — created with the anon key and then
 *      authenticated with the caller's JWT. Every query goes through RLS
 *      exactly as it would from the browser, except the token stays on the
 *      server and the publishable key is not shipped to the frontend.
 */
import { createClient } from '@supabase/supabase-js';
import env from './env.js';

/**
 * Admin client — bypasses Row Level Security.
 * Use only for operations that genuinely need it.
 */
export const adminClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Creates a Supabase client authenticated as a specific user.
 *
 * This client respects RLS: the database sees `auth.uid()` as the user who
 * owns the supplied access token. This is the correct client for any call
 * that should be scoped to a specific person (events, RSVPs, profiles).
 *
 * @param {string} accessToken  The user's Supabase access token (JWT)
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createUserClient(accessToken) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}
