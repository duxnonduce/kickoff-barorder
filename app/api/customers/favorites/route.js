import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Pubblica di proposito: il cliente non ha un login, si identifica per
// telefono (lo stesso usato in fase di registrazione ordine).
export async function POST(req) {
  const { phone, product_id, action } = await req.json();

  if (!phone?.trim() || !product_id || !["add", "remove"].includes(action)) {
    return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 });
  }

  const { data: customer, error: findErr } = await supabaseAdmin
    .from("customers")
    .select("id, favorite_product_ids")
    .eq("phone", phone.trim())
    .maybeSingle();

  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 });
  if (!customer) return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });

  const current = customer.favorite_product_ids || [];
  const next =
    action === "add"
      ? Array.from(new Set([...current, product_id]))
      : current.filter((id) => id !== product_id);

  const { data, error } = await supabaseAdmin
    .from("customers")
    .update({ favorite_product_ids: next })
    .eq("id", customer.id)
    .select("favorite_product_ids")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ favorite_product_ids: data.favorite_product_ids });
}
