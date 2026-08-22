import { NextResponse } from "next/server";
import { supabaseAdmin, checkPin } from "@/lib/supabaseAdmin";

export async function POST(req) {
  const { pin, group_id, name, price_delta } = await req.json();
  if (!checkPin(pin, "admin")) {
    return NextResponse.json({ error: "PIN non valido" }, { status: 401 });
  }
  if (!group_id || !name?.trim()) {
    return NextResponse.json({ error: "Gruppo e nome opzione obbligatori" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("product_options")
    .insert({ group_id, name: name.trim(), price_delta: parseFloat(price_delta) || 0 })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ option: data });
}
