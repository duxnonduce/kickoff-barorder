import { createClient } from "@supabase/supabase-js";

// SOLO lato server (API routes). Bypassa RLS: mai importare in un componente client.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// PIN staff molto semplice per v1: protegge le azioni bar/admin.
// In una v2 conviene sostituirlo con Supabase Auth + ruoli, come in PointLab.
export function checkStaffPin(pin) {
  return pin && pin === process.env.STAFF_PIN;
}
