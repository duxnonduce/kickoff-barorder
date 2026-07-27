import { NextResponse } from "next/server";
import { supabaseAdmin, checkPin } from "@/lib/supabaseAdmin";

export async function POST(req) {
  const { pin, zone_id, label } = await req.json();
  if (!checkPin(pin, "admin")) {
    return NextResponse.json({ error: "PIN non valido" }, { status: 401 });
  }
  if (!zone_id || !label) {
    return NextResponse.json({ error: "Zona ed etichetta obbligatorie" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("tables")
    .insert({ zone_id, label })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ table: data });
}

export async function DELETE(req) {
  const { pin, id } = await req.json();
  if (!checkPin(pin, "admin")) {
    return NextResponse.json({ error: "PIN non valido" }, { status: 401 });
  }
  const { error } = await supabaseAdmin.from("tables").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
