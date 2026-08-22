import { NextResponse } from "next/server";
import { supabaseAdmin, checkPin } from "@/lib/supabaseAdmin";

export async function POST(req) {
  const { pin, product_id, name, selection_type, required } = await req.json();
  if (!checkPin(pin, "admin")) {
    return NextResponse.json({ error: "PIN non valido" }, { status: 401 });
  }
  if (!product_id || !name?.trim()) {
    return NextResponse.json({ error: "Prodotto e nome gruppo obbligatori" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("product_option_groups")
    .insert({
      product_id,
      name: name.trim(),
      selection_type: selection_type === "multiple" ? "multiple" : "single",
      required: !!required,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ group: data });
}
