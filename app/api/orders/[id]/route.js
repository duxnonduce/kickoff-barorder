import { NextResponse } from "next/server";
import { supabaseAdmin, checkStaffPin } from "@/lib/supabaseAdmin";

export async function PATCH(req, { params }) {
  const { id } = params;
  const body = await req.json();
  const { status, pin } = body;

  if (!checkStaffPin(pin)) {
    return NextResponse.json({ error: "PIN non valido" }, { status: 401 });
  }

  const allowed = ["accettato", "pronto", "completato", "rifiutato"];
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: "Stato non valido" }, { status: 400 });
  }

  const patch = { status };
  if (status === "accettato") patch.accepted_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("orders")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Alla accettazione: segna come da stampare. Il print-agent locale
  // (vedi /print-agent) ascolta questo evento via Supabase Realtime
  // e stampa lo scontrino sulla stampante di rete del bar.
  if (status === "accettato") {
    await supabaseAdmin.from("orders").update({ printed_at: null }).eq("id", id);
  }

  return NextResponse.json({ order: data });
}
