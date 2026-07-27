import { createClient } from "@supabase/supabase-js";

// Usato lato browser (cliente, bar, admin): chiave anonima, rispetta le policy RLS.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
