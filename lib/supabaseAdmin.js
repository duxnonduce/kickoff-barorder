import { createClient } from "@supabase/supabase-js";

// SOLO lato server (API routes). Bypassa RLS: mai importare in un componente client.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// PIN staff separati per v1: protegge le azioni bar/admin.
// L'ADMIN_PIN funziona ovunque (anche in /bar). Il BAR_PIN funziona solo
// per le azioni operative del banco, non per prodotti/postazioni/zone.
// In una v2 conviene sostituire tutto con Supabase Auth + ruoli, come in PointLab.
export function checkPin(pin, role = "bar") {
  if (!pin) return false;
  if (role === "admin") return pin === process.env.ADMIN_PIN;
  // role "bar": accetta sia il PIN bar che quello admin
  return pin === process.env.BAR_PIN || pin === process.env.ADMIN_PIN;
}
