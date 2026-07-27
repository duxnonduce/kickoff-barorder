import { NextResponse } from "next/server";
import { supabaseAdmin, checkPin } from "@/lib/supabaseAdmin";

export async function POST(req) {
  const { pin, name, price, category_id, prep_min } = await req.json();
  if (!checkPin(pin, "admin")) {
    return NextResponse.json({ error: "PIN non valido" }, { status: 401 });
  }
  if (!name || price == null) {
    return NextResponse.json({ error: "Nome e prezzo obbligatori" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("products")
    .insert({ name, price, category_id, prep_min: prep_min || 5, available: true })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ product: data });
}
