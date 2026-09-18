import { createClient } from '@supabase/supabase-js';

/**
 * Single shared Supabase browser client.
 *
 * The publishable key is meant to ship to the browser. It carries no authority
 * on its own — every read and write is gated by Row Level Security and by the
 * SECURITY DEFINER functions in supabase/migrations. The service_role key is
 * deliberately absent from this project; it bypasses RLS and nothing here needs
 * it.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    'Supabase is not configured. Copy .env.example to .env.local and fill in ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then restart the dev server.'
  );
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'havan-auth'
  }
});
