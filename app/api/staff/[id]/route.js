import { NextResponse } from "next/server";
import { supabaseAdmin, checkPin } from "@/lib/supabaseAdmin";

export async function DELETE(req, { params }) {
  const { id } = params;
  const { pin } = await req.json();
  if (!checkPin(pin, "admin")) {
    return NextResponse.json({ error: "PIN non valido" }, { status: 401 });
  }
  // Soft: disattivo invece di cancellare, così il nome resta leggibile
  // nello storico del registro attività passato.
  const { error } = await supabaseAdmin.from("staff").update({ active: false }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
