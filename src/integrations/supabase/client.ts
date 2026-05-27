// ============= Sealed infrastructure client =============
// Environment-driven only — no hardcoded project references
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  throw new Error('[supabase/client] Missing VITE_SUPABASE_URL');
}

if (!SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('[supabase/client] Missing VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY');
}

if (import.meta.env.DEV && SUPABASE_URL.includes('wkrcyxcnzhwjtdpmfpaf')) {
  throw new Error('[supabase/client] Refusing to use old Lovable/main Supabase project in forensic_report_v2 local dev');
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
