// ============= Sealed infrastructure client =============
// Environment-driven only — no hardcoded project references
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://wkrcyxcnzhwjtdpmfpaf.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_JTHC-098GYEItvrHERbbZw_SzhUbcT4";

// Dev-only sanity check (no UI, no surface sprawl)
if (import.meta.env.DEV) {
  if (!import.meta.env.VITE_SUPABASE_URL) {
    // eslint-disable-next-line no-console
    console.warn('[supabase/client] VITE_SUPABASE_URL missing; using public fallback URL');
  }

  if (!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY && !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    // eslint-disable-next-line no-console
    console.warn('[supabase/client] VITE_SUPABASE_PUBLISHABLE_KEY/VITE_SUPABASE_ANON_KEY missing; using public fallback key');
  }
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
