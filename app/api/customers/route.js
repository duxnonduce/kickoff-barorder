import { NextResponse } from "next/server";
import { supabaseAdmin, checkPin } from "@/lib/supabaseAdmin";

// Registrazione cliente, chiamata dal form prima di un ordine.
// Pubblica di proposito (il cliente non ha un login): usa il telefono
// come chiave, così se torna con lo stesso numero aggiorniamo nome/email
// invece di creare un duplicato.
export async function POST(req) {
  const { name, email, phone } = await req.json();

  if (!name?.trim() || !phone?.trim()) {
    return NextResponse.json({ error: "Nome e telefono obbligatori" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("customers")
    .upsert(
      { name: name.trim(), email: email?.trim() || null, phone: phone.trim() },
      { onConflict: "phone" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ customer: data });
}

// Elenco clienti, solo per l'admin.
export async function GET(req) {
  const pin = req.nextUrl.searchParams.get("pin");
  if (!checkPin(pin, "admin")) {
    return NextResponse.json({ error: "PIN non valido" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ customers: data });
}
